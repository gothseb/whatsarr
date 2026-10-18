import { Injectable } from "@nestjs/common";
import { SettingsService } from "../settings/settings.service";
import { AgentSourceSession, record, nonNegativeInteger, optionalString } from "./agent-source";
import { AgentError } from "./agent.types";
import { pagination, scalarQuery } from "./agent-media.dto";
import { queryId } from "./agent-arr.dto";
import { invalidRequest } from "./agent.dto";
@Injectable()
export class AgentRequestsService {
    constructor(private readonly settings: SettingsService) { }
    private async run<T>(callback: (get: (path: string) => Promise<unknown>) => Promise<T>) {
        const cfg = await this.settings.getDecryptedService("overseerr");
        if (!cfg?.baseUrl || !cfg.apiKey)
            throw new AgentError(409, "SEERR_NOT_CONFIGURED", "Seerr n’est pas configuré.");
        let base: URL;
        try {
            base = new URL(cfg.baseUrl);
            if (!["http:", "https:"].includes(base.protocol))
                throw Error();
        }
        catch {
            throw new AgentError(409, "SEERR_NOT_CONFIGURED", "URL Seerr invalide.");
        }
        const s = new AgentSourceSession("SEERR");
        try {
            return await callback(path => { const u = new URL(base); u.pathname = u.pathname.replace(/\/+$/, "") + "/api/v1/" + path.split("?")[0]; u.search = path.includes("?") ? path.slice(path.indexOf("?")) : ""; u.hash = ""; return s.json(u, { "X-Api-Key": cfg.apiKey! }); });
        }
        finally {
            s.close();
        }
    }
    private normalize(row: Record<string, unknown>, details: Record<string, unknown> | null) { const media = record(row.media), user = record(row.requestedBy); return { id: nonNegativeInteger(row.id), mediaType: row.type === "movie" ? "movie" : row.type === "tv" ? "series" : null, title: optionalString(details?.title ?? details?.name), tmdbId: nonNegativeInteger(media?.tmdbId), tvdbId: nonNegativeInteger(media?.tvdbId), requestStatus: nonNegativeInteger(row.status), is4k: typeof row.is4k === "boolean" ? row.is4k : null, mediaStatus: nonNegativeInteger(row.is4k === true ? media?.status4k : media?.status), requestedBy: { id: nonNegativeInteger(user?.id), name: optionalString(user?.displayName) ?? optionalString(user?.username) ?? optionalString(user?.plexUsername) }, createdAt: optionalString(row.createdAt), updatedAt: optionalString(row.updatedAt), seasons: Array.isArray(row.seasons) ? row.seasons.map(v => { const r = record(v); return { seasonNumber: nonNegativeInteger(r?.seasonNumber), status: nonNegativeInteger(r?.status) }; }) : [] }; }
    async list(value: unknown) {
        const q = scalarQuery(value, ["mediaType", "status", "requestedBy", "offset", "limit"]), page = pagination(q);
        if (q.mediaType !== undefined && !["movie", "series"].includes(q.mediaType))
            invalidRequest();
        const status = q.status === undefined ? undefined : queryId(q.status), user = q.requestedBy === undefined ? undefined : queryId(q.requestedBy);
        if (status !== undefined && ![1, 2, 3, 4, 5].includes(status))
            invalidRequest();
        return this.run(async (get) => {
            const filtered: Record<string, unknown>[] = [];
            let skip = 0;
            const seen = new Set<number>();
            for (let n = 0;; n++) {
                if (n >= 200 || skip >= 20000)
                    throw new AgentError(502, "SEERR_TOO_LARGE", "Trop de demandes à parcourir.");
                const body = record(await get(`request?take=100&skip=${skip}&sort=added`));
                if (!body || !Array.isArray(body.results))
                    throw new AgentError(502, "SEERR_INVALID_RESPONSE", "Liste de demandes inexploitable.");
                const rows = body.results.map(record);
                if (rows.some(r => !r))
                    throw new AgentError(502, "SEERR_INVALID_RESPONSE", "Demande invalide.");
                for (const row of rows as Record<string, unknown>[]) {
                    const id=nonNegativeInteger(row.id);
                    if(id===null || seen.has(id)) throw new AgentError(502,"SEERR_INVALID_RESPONSE","Pagination de demandes incohérente.");
                    seen.add(id);
                }
                for (const r of rows as Record<string, unknown>[])
                    if ((q.mediaType === undefined || r.type === (q.mediaType === "movie" ? "movie" : "tv")) && (status === undefined || r.status === status) && (user === undefined || record(r.requestedBy)?.id === user))
                        filtered.push(r);
                skip += rows.length;
                const total = nonNegativeInteger(record(body.pageInfo)?.results);
                if(total!==null && skip>total || !rows.length && total!==null && skip<total)
                    throw new AgentError(502,"SEERR_INVALID_RESPONSE","Pagination de demandes incomplète.");
                if (total !== null && skip >= total || !rows.length)
                    break;
            }
            filtered.sort((a, b) => Number(a.id) - Number(b.id));
            const items = [];
            for (const row of filtered.slice(page.offset, page.offset + page.limit)) {
                const m = record(row.media), id = nonNegativeInteger(m?.tmdbId);
                const details = id && ["movie", "tv"].includes(String(row.type)) ? record(await get(`${row.type}/${id}`)) : null;
                items.push(this.normalize(row, details));
            }
            return { source: "seerr", items, pagination: { ...page, hasMore: filtered.length > page.offset + page.limit } };
        });
    }
    async detail(id: number) { return this.run(async (get) => { const row = record(await get(`request/${id}`)); if (!row || row.id !== id)
        throw new AgentError(502, "SEERR_INVALID_RESPONSE", "Demande inexploitable."); const tmdbId = nonNegativeInteger(record(row.media)?.tmdbId), details = tmdbId && ["movie", "tv"].includes(String(row.type)) ? record(await get(`${row.type}/${tmdbId}`)) : null; return { source: "seerr", item: this.normalize(row, details) }; }); }
}

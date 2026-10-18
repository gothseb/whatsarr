import { Injectable } from "@nestjs/common";
import { SettingsService } from "../settings/settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AgentSourceSession, record, optionalString, nonNegativeInteger } from "./agent-source";
import { AgentError } from "./agent.types";
import { ArrAdd, ArrSource, arrQuery } from "./agent-arr.dto";
@Injectable()
export class AgentArrService {
    private readonly additions = new Map<string, Promise<unknown>>();
    constructor(private readonly settings: SettingsService, private readonly notifications: NotificationsService) { }
    async session(source: ArrSource) {
        const cfg = await this.settings.getDecryptedService(source);
        if (!cfg?.baseUrl || !cfg.apiKey)
            throw new AgentError(409, `${source.toUpperCase()}_NOT_CONFIGURED`, `${source} n’est pas configuré.`);
        let base: URL;
        try {
            base = new URL(cfg.baseUrl);
            if (!["http:", "https:"].includes(base.protocol))
                throw Error();
        }
        catch {
            throw new AgentError(409, `${source.toUpperCase()}_NOT_CONFIGURED`, "URL du service invalide.");
        }
        const session = new AgentSourceSession(source === "radarr" ? "RADARR" : "SONARR");
        return { close: () => session.close(), get: async (path: string, body?: unknown) => { const u = new URL(base); u.pathname = u.pathname.replace(/\/+$/, "") + "/api/v3/" + path.split("?")[0]; u.search = path.includes("?") ? path.slice(path.indexOf("?")) : ""; u.hash = ""; return session.json(u, { "X-Api-Key": cfg.apiKey! }, body); } };
    }
    async tags(source: ArrSource) { const s = await this.session(source); try {
        return { source, items: this.tagsFrom(await s.get("tag")) };
    }
    finally {
        s.close();
    } }
    private positiveId(value:unknown):number {
        if(typeof value!=="number" || !Number.isSafeInteger(value) || value<1)
            throw new AgentError(502,"ARR_INVALID_RESPONSE","Identifiant amont inexploitable.");
        return value;
    }
    private tagsFrom(value: unknown) {
        return this.rows(value).map(row=>{
            const id=this.positiveId(row.id),label=optionalString(row.label);
            if(!label) throw new AgentError(502,"ARR_INVALID_RESPONSE","Tag invalide.");
            return {id,label};
        });
    }
    private trackedRows(value:unknown,source:ArrSource) {
        const external=source==="radarr"?"tmdbId":"tvdbId";
        return this.rows(value).map(row=>{
            this.positiveId(row.id);this.positiveId(row[external]);
            if(!optionalString(row.title)) throw new AgentError(502,"ARR_INVALID_RESPONSE","Titre amont inexploitable.");
            if(row.tags!==undefined && !Array.isArray(row.tags)) throw new AgentError(502,"ARR_INVALID_RESPONSE","Tags amont inexploitables.");
            if(Array.isArray(row.tags)) row.tags.forEach(id=>this.positiveId(id));
            return row;
        });
    }
    private rows(value: unknown): Record<string, unknown>[] { if (!Array.isArray(value) || value.length > 20000 || value.some(v => !record(v)))
        throw new AgentError(502, "ARR_INVALID_RESPONSE", "Catalogue inexploitable ou trop volumineux."); return value as Record<string, unknown>[]; }
    private normalize(r: Record<string, unknown>, source: ArrSource, tags: {
        id: number;
        label: string;
    }[]) {
        const stats = record(r.statistics);
        return { id: nonNegativeInteger(r.id), title: optionalString(r.title), tmdbId: nonNegativeInteger(r.tmdbId), tvdbId: nonNegativeInteger(r.tvdbId), year: nonNegativeInteger(r.year), monitored: typeof r.monitored === "boolean" ? r.monitored : null, status: optionalString(r.status), hasFile: source === "radarr" ? (typeof r.hasFile === "boolean" ? r.hasFile : null) : null, episodeFileCount: source === "sonarr" ? nonNegativeInteger(stats?.episodeFileCount) : null, episodeCount: source === "sonarr" ? nonNegativeInteger(stats?.episodeCount) : null, tags: Array.isArray(r.tags) ? r.tags.map(id => ({ id: this.positiveId(id), label: tags.find(t => t.id === id)?.label ?? null })) : [] };
    }
    async list(source: ArrSource, query: ReturnType<typeof arrQuery>) { const s = await this.session(source); try {
        const rows = this.trackedRows(await s.get(source === "radarr" ? "movie" : "series"),source), tags = this.tagsFrom(await s.get("tag"));
        const items = rows.filter(r => (!query.q || String(r.title ?? "").toLowerCase().includes(query.q.toLowerCase())) && (query.tagId === undefined || Array.isArray(r.tags) && r.tags.includes(query.tagId)) && (query.monitored === undefined || r.monitored === query.monitored)).map(r => this.normalize(r, source, tags)).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "") || (a.id ?? 0) - (b.id ?? 0));
        return { source, items: items.slice(query.offset, query.offset + query.limit), pagination: { offset: query.offset, limit: query.limit, hasMore: items.length > query.offset + query.limit } };
    }
    finally {
        s.close();
    } }
    async options(source: ArrSource) { const s = await this.session(source); try {
        return { source, qualityProfiles: this.rows(await s.get("qualityprofile")).map(r => ({ id: this.positiveId(r.id), name: optionalString(r.name) })), rootFolders: this.rows(await s.get("rootfolder")).map(r => ({ id: this.positiveId(r.id), path: optionalString(r.path), accessible: typeof r.accessible === "boolean" ? r.accessible : null, freeSpace: nonNegativeInteger(r.freeSpace) })), tags: this.tagsFrom(await s.get("tag")) };
    }
    finally {
        s.close();
    } }
    async lookup(source: ArrSource, id: number) { const s = await this.session(source); try {
        return { source, items: this.rows(await s.get(`${source === "radarr" ? "movie" : "series"}/lookup?term=${source === "radarr" ? "tmdb" : "tvdb"}:${id}`)).filter(r => r[source === "radarr" ? "tmdbId" : "tvdbId"] === id).map(r => ({ title: optionalString(r.title), year: nonNegativeInteger(r.year), tmdbId: nonNegativeInteger(r.tmdbId), tvdbId: nonNegativeInteger(r.tvdbId), overview: optionalString(r.overview) })) };
    }
    finally {
        s.close();
    } }
    async presence(source: ArrSource, id: number) { const s = await this.session(source); try {
        const row = this.trackedRows(await s.get(source === "radarr" ? "movie" : "series"),source).find(r => r[source === "radarr" ? "tmdbId" : "tvdbId"] === id);
        return { state: "known" as const, tracked: !!row, item: row ? this.normalize(row, source, []) : null };
    }
    finally {
        s.close();
    } }
    async add(source: ArrSource, input: ArrAdd, requestId: string): Promise<{source:ArrSource;item:ReturnType<AgentArrService["normalize"]>|null;deduplicated:boolean;reconciled?:boolean}> {
        const key = `${source}:${input.externalId}`;
        const pending = this.additions.get(key);
        if (pending) {
            try { await pending; }
            catch(error) {
                if(!(error instanceof AgentError) || error.code==="ARR_ADD_UNCERTAIN") throw error;
                if(this.additions.get(key)===pending) this.additions.delete(key);
                return this.add(source,input,requestId);
            }
            const check = await this.presence(source, input.externalId);
            if (check.tracked)
                return { source, item: check.item, deduplicated: true };
            throw new AgentError(502, "ARR_ADD_UNCERTAIN", "Ajout simultané non confirmé ; vérifiez le suivi.");
        }
        const work = this.performAdd(source, input, requestId);
        this.additions.set(key, work);
        try {
            return await work;
        }
        finally {
            if (this.additions.get(key) === work)
                this.additions.delete(key);
        }
    }
    private async performAdd(source: ArrSource, input: ArrAdd, requestId: string) {
        const s = await this.session(source), entity = source === "radarr" ? "movie" : "series", external = source === "radarr" ? "tmdbId" : "tvdbId";
        const find = async () => this.trackedRows(await s.get(entity),source).find(r => r[external] === input.externalId);
        try {
            const exists = await find();
            if (exists) {
                await this.audit(source, input.externalId, requestId, "deduplicated");
                return { source, item: this.normalize(exists, source, []), deduplicated: true };
            }
            const profiles = this.rows(await s.get("qualityprofile")), folders = this.rows(await s.get("rootfolder")), tags = this.tagsFrom(await s.get("tag"));
            profiles.forEach(row=>this.positiveId(row.id));folders.forEach(row=>this.positiveId(row.id));
            const folder = folders.find(r => r.id === input.rootFolderId);
            if (!profiles.some(r => r.id === input.qualityProfileId) || !folder || !optionalString(folder.path) || folder.accessible === false || input.tagIds.some(id => !tags.some(t => t.id === id)))
                throw new AgentError(400, "ARR_INVALID_OPTIONS", "Profil, dossier ou tags invalides ou inaccessibles.");
            const match = this.rows(await s.get(`${entity}/lookup?term=${source === "radarr" ? "tmdb" : "tvdb"}:${input.externalId}`)).find(r => r[external] === input.externalId);
            if (!match || !optionalString(match.title))
                throw new AgentError(404, "ARR_TITLE_NOT_FOUND", "Identifiant introuvable dans le catalogue amont.");
            const seasons = source === "sonarr" ? this.rows(match.seasons) : [];
            if (input.seasonNumbers?.some(n => !seasons.some(r => r.seasonNumber === n)))
                throw new AgentError(400, "ARR_INVALID_SEASONS", "Saison inconnue.");
            const metadata = Object.fromEntries(["title", "titleSlug", "year", "images", "tmdbId", "tvdbId", "imdbId", "overview", "runtime", "seriesType", "originalLanguage"].filter(k => match[k] !== undefined).map(k => [k, match[k]]));
            const body = { ...metadata, qualityProfileId: input.qualityProfileId, rootFolderPath: folder.path, tags: input.tagIds, monitored: input.monitored, ...(source === "radarr" ? { addOptions: { searchForMovie: input.search } } : { seasonFolder: true, seasons: seasons.map(r => ({ seasonNumber: r.seasonNumber, monitored: input.monitored && (input.seasonNumbers ? input.seasonNumbers.includes(r.seasonNumber as number) : (r.seasonNumber as number) > 0) })), addOptions: { monitor: "skip", searchForMissingEpisodes: input.search, searchForCutoffUnmetEpisodes: false } }) };
            let created: Record<string, unknown> | null;
            try {
                created = record(await s.get(entity, body));
                if (!created || created[external] !== input.externalId) throw new Error();
                this.trackedRows([created],source);
            }
            catch (error) {
                if (error instanceof AgentError && /_(BAD_REQUEST|NOT_FOUND|AUTHENTICATION_ERROR|RATE_LIMITED)$/.test(error.code)) {
                    if (error.code.endsWith("BAD_REQUEST")) {
                        const concurrent = await this.presence(source, input.externalId).catch(() => null);
                        if (concurrent?.tracked) {
                            await this.audit(source, input.externalId, requestId, "deduplicated");
                            return { source, item: concurrent.item, deduplicated: true, reconciled: true };
                        }
                    }
                    await this.audit(source, input.externalId, requestId, "rejected");
                    throw error;
                }
                // A POST may have committed even when its response was lost. A fresh deadline permits reconciliation, never another POST.
                const check = await this.presence(source, input.externalId).catch(() => null);
                if (check?.tracked) {
                    await this.audit(source, input.externalId, requestId, "reconciled");
                    return { source, item: check.item, deduplicated: true, reconciled: true };
                }
                await this.audit(source, input.externalId, requestId, "uncertain");
                throw new AgentError(502, "ARR_ADD_UNCERTAIN", "Résultat de l’ajout incertain. Consultez le suivi avant toute répétition ; aucun nouvel ajout automatique.");
            }
            await this.audit(source, input.externalId, requestId, "created");
            return { source, item: this.normalize(created, source, tags), deduplicated: false };
        }
        finally {
            s.close();
        }
    }
    private async audit(source: ArrSource, id: number, requestId: string, outcome: string) { await this.notifications.log({ level: outcome === "created" ? "info" : "warn", event: `agent.${source}.add.${outcome}`, requestId, message: `Ajout ${source} : ${outcome}.`, context: { source, externalId: id } }).catch(() => undefined); }
}

import { createHash } from "node:crypto";
import { AgentSourceSession, record, identifier, optionalString, nonNegativeInteger } from "../agent/agent-source";
import { AgentError } from "../agent/agent.types";
import { normalizePlexItem } from "./plex-catalogue";
export interface CollectionQuery {
    offset: number;
    limit: number;
    libraryKey?: string;
    q?: string;
}
export async function plexCollectionRead(config: {
    baseUrl: string;
    apiKey: string;
}, allowed: ReadonlySet<string>, query: CollectionQuery, id?: string) {
    return plexRead(config, allowed, query, async (ctx) => {
        const collections: Record<string, unknown>[] = [];
        for (const section of ctx.sections) {
            const rows = await ctx.pages(`/library/sections/${encodeURIComponent(section.key)}/collections`);
            for (const row of rows) {
                if (!identifier(row.ratingKey) || !optionalString(row.title))
                    ctx.session.error("UNREACHABLE");
                if (row.librarySectionID !== undefined && identifier(row.librarySectionID) !== section.key)
                    ctx.session.error("UNREACHABLE");
                collections.push({ ...row, librarySectionID: section.key });
            }
        }
        if (id !== undefined) {
            const collection = collections.find(r => identifier(r.ratingKey) === id);
            if (!collection)
                throw new AgentError(404, "PLEX_COLLECTION_NOT_FOUND", "Collection introuvable ou hors des bibliothèques Récap.");
            const library = String(collection.librarySectionID);
            const rows = await ctx.pages(`/library/metadata/${encodeURIComponent(id)}/children`, {}, library);
            const items = rows.filter(r => ["movie", "show"].includes(String(r.type))).map(r => { if (r.librarySectionID !== undefined && identifier(r.librarySectionID) !== library)
                ctx.session.error("UNREACHABLE"); return normalizePlexItem(r, library, ctx.session); }).filter(r => !query.q || r.title.toLowerCase().includes(query.q.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title) || a.ratingKey.localeCompare(b.ratingKey));
            return page(items, query);
        }
        const items = collections.filter(r => !query.q || String(r.title).toLowerCase().includes(query.q.toLowerCase())).map(r => ({ id: identifier(r.ratingKey), libraryKey: identifier(r.librarySectionID), title: optionalString(r.title), summary: optionalString(r.summary), childCount: nonNegativeInteger(r.childCount), collectionType: optionalString(r.subtype) })).sort((a, b) => a.title!.localeCompare(b.title!) || a.libraryKey!.localeCompare(b.libraryKey!) || a.id!.localeCompare(b.id!));
        return page(items, query);
    });
}
function page<T>(items: T[], query: CollectionQuery) { return { source: "plex", items: items.slice(query.offset, query.offset + query.limit), pagination: { offset: query.offset, limit: query.limit, hasMore: items.length > query.offset + query.limit } }; }
export async function plexExactAvailability(config: {
    baseUrl: string;
    apiKey: string;
}, allowed: ReadonlySet<string>, type: "movie" | "series", id: number) {
    return plexRead(config, allowed, { offset: 0, limit: 100 }, async (ctx) => { const items = []; let unmatched=false; for (const section of ctx.sections) {
        if (section.type !== (type === "movie" ? "movie" : "show"))
            continue;
        for (const r of await ctx.pages(`/library/sections/${encodeURIComponent(section.key)}/all`, { type: type === "movie" ? "1" : "2", includeGuids: "1" })) {
            const guids = [r.guid, ...(Array.isArray(r.Guid) ? r.Guid.map(g => record(g)?.id) : [])];
            const externalIds=guids.map(g=>externalPlexId(g,type)).filter((n):n is number=>n!==null);
            if(!externalIds.length) unmatched=true;
            if(!externalIds.includes(id)) continue;
            if (r.librarySectionID !== undefined && identifier(r.librarySectionID) !== section.key)
                ctx.session.error("UNREACHABLE");
            items.push({ ...normalizePlexItem(r, section.key, ctx.session), episodeCount: type === "series" ? nonNegativeInteger(r.leafCount) : null });
        }
    }
    if(!items.length && unmatched) throw new AgentError(502,"PLEX_IDENTIFIERS_UNAVAILABLE","Des médias Plex ne permettent pas de vérifier une absence par identifiant exact.");
    return { state: "known" as const, present: items.length > 0, items }; });
}
async function plexRead<T>(config: {
    baseUrl: string;
    apiKey: string;
}, allowed: ReadonlySet<string>, query: CollectionQuery, work: (ctx: {
    session: AgentSourceSession;
    sections: {
        key: string;
        type: string;
    }[];
    pages: (path: string, params?: Record<string, string>, expectedLibraryKey?: string) => Promise<Record<string, unknown>[]>;
}) => Promise<T>): Promise<T> {
    if (query.libraryKey !== undefined && !allowed.has(query.libraryKey))
        throw new AgentError(404, "PLEX_LIBRARY_NOT_FOUND", "Bibliothèque exclue du récapitulatif.");
    const session: AgentSourceSession = new AgentSourceSession("PLEX");
    let consumed = 0;
    const url = (path: string) => { const u = new URL(config.baseUrl); u.pathname = u.pathname.replace(/\/+$/, "") + path; u.search = ""; u.hash = ""; return u; };
    const get = async (path: string, params: Record<string, string> = {}) => { const u = url(path); for (const [k, v] of Object.entries(params))
        u.searchParams.set(k, v); const data = record(record(await session.json(u, { "X-Plex-Token": config.apiKey }))?.MediaContainer); if (!data)
        session.error("UNREACHABLE"); return data; };
    const pages = async (path: string, params: Record<string, string> = {}, expectedLibraryKey?: string) => { const all: Record<string, unknown>[] = [], seen = new Set<string>(); let start = 0; for (let n = 0;; n++) {
        if (n >= 200 || consumed >= 20000)
            session.error("UNREACHABLE");
        const data = await get(path, { ...params, "X-Plex-Container-Start": String(start), "X-Plex-Container-Size": "100" }), rows = data.Metadata ?? data.Directory ?? (nonNegativeInteger(data.size) === 0 ? [] : undefined);
        if (!Array.isArray(rows))
            session.error("UNREACHABLE");
        const scope=expectedLibraryKey ?? (path.startsWith("/library/sections/") ? decodeURIComponent(path.split("/")[3]) : undefined);
        if(scope!==undefined && data.librarySectionID!==undefined && identifier(data.librarySectionID)!==scope)
            session.error("UNREACHABLE");
        const total = nonNegativeInteger(data.totalSize);
        if (data.offset !== undefined && nonNegativeInteger(data.offset) !== start || data.size !== undefined && nonNegativeInteger(data.size) !== rows.length || total !== null && total < start + rows.length)
            session.error("UNREACHABLE");
        if (!rows.length) {
            if (total !== null && start < total)
                session.error("UNREACHABLE");
            break;
        }
        const fingerprint = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
        if (seen.has(fingerprint))
            session.error("UNREACHABLE");
        seen.add(fingerprint);
        consumed += rows.length;
        if (consumed > 20000)
            session.error("UNREACHABLE");
        for (const row of rows) {
            const r = record(row);
            if (!r)
                session.error("UNREACHABLE");
            all.push(r);
        }
        start += rows.length;
        if (total !== null && start >= total)
            break;
    } return all; };
    try {
        let sections: {
            key: string;
            type: string;
        }[] = [];
        if (allowed.size) {
            const data = await get("/library/sections");
            if (!Array.isArray(data.Directory) && !(data.Directory === undefined && nonNegativeInteger(data.size) === 0))
                session.error("UNREACHABLE");
            sections = (Array.isArray(data.Directory) ? data.Directory : []).map(value=>{
                const row=record(value),key=identifier(row?.key),type=optionalString(row?.type);
                if(!row||!key||!type) session.error("UNREACHABLE");
                return {key,type};
            }).filter(row=>allowed.has(row.key)&&["movie","show"].includes(row.type)&&(query.libraryKey===undefined||row.key===query.libraryKey));
        }
        return await work({ session, sections, pages });
    }
    finally {
        session.close();
    }
}

function externalPlexId(value:unknown,type:"movie"|"series"):number|null {
    if(typeof value!=="string") return null;
    const prefix=type==="movie"?"(?:tmdb|com\\.plexapp\\.agents\\.themoviedb)":"(?:tvdb|com\\.plexapp\\.agents\\.thetvdb)";
    const match=new RegExp(`^${prefix}://([1-9]\\d*)(?:\\?[^#]*)?$`).exec(value);
    if(!match) return null;
    const id=Number(match[1]);return Number.isSafeInteger(id)?id:null;
}

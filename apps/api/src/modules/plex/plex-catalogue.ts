import { createHash } from "node:crypto";
import { AgentSourceSession, record, identifier, optionalString, nonNegativeInteger, unixDate } from "../agent/agent-source";
import { AgentError } from "../agent/agent.types";
import { AgentMediaItem, AgentMediaQuery, AgentRecentItem, AgentRecentQuery } from "../agent/agent-media.types";

type PlexConfig = {baseUrl:string;apiKey:string};
export async function searchPlexCatalogue(config: PlexConfig, query: AgentMediaQuery, allowedLibraryKeys?: ReadonlySet<string>) {
  const result = await readCatalogue(config,query,false,allowedLibraryKeys);
  return {...result,items:result.items as AgentMediaItem[]};
}
export async function recentPlexCatalogue(config: PlexConfig, query: AgentRecentQuery, allowedLibraryKeys?: ReadonlySet<string>) {
  const result = await readCatalogue(config,query,true,allowedLibraryKeys);
  return {...result,items:result.items as AgentRecentItem[]};
}
async function readCatalogue(config: PlexConfig, query: AgentMediaQuery | AgentRecentQuery, recent: boolean, allowedLibraryKeys?: ReadonlySet<string>) {
  if (query.libraryKey !== undefined && allowedLibraryKeys !== undefined && !allowedLibraryKeys.has(query.libraryKey)) throw new AgentError(404,"PLEX_LIBRARY_NOT_FOUND","Bibliothèque Plex introuvable ou non activée pour le récapitulatif.");
  if (allowedLibraryKeys?.size === 0) return {items: [], pagination: { offset: query.offset, limit: query.limit, hasMore: false }, source: "plex" as const};
  const session: AgentSourceSession = new AgentSourceSession("PLEX");
  try {
    const url = (path: string) => {
      const base = new URL(config.baseUrl);
      base.pathname = base.pathname.replace(/\/+$/, "") + path;
      base.search = "";
      base.hash = "";
      return base;
    };
    const headers = {"X-Plex-Token": config.apiKey};
    const root = record(await session.json(url("/library/sections"),headers));
    const container = record(root?.MediaContainer);
    if (!container || (!Array.isArray(container.Directory) && !(container.Directory === undefined && nonNegativeInteger(container.size) === 0))) session.error("UNREACHABLE");
    const sections = (container.Directory as unknown[] | undefined ?? []).map(item => {
      const row = record(item);
      const key = identifier(row?.key), type = optionalString(row?.type);
      if (!key || !type) session.error("UNREACHABLE");
      return {key,type};
    });
    if (query.libraryKey !== undefined && !sections.some(section => section.key === query.libraryKey)) throw new AgentError(404,"PLEX_LIBRARY_NOT_FOUND","Bibliotheque Plex introuvable.");
    const items = new Map<string,AgentMediaItem | AgentRecentItem>();
    let consumed = 0;
    for (const section of sections) {
      if (allowedLibraryKeys !== undefined && !allowedLibraryKeys.has(section.key)) continue;
      if (query.libraryKey !== undefined && section.key !== query.libraryKey) continue;
      if (!["movie","show"].includes(section.type)) continue;
      const types = section.type === "movie" ? ["movie"] : recent ? ["series","episode"] : ["series"];
      for (const type of types) {
        if (query.mediaType && query.mediaType !== type) continue;
        const fingerprints = new Set<string>();
        let start = 0;
        for (let page = 0; ; page++) {
          if (page >= 200 || consumed >= 20_000) session.error("UNREACHABLE");
          const pageUrl = url(`/library/sections/${encodeURIComponent(section.key)}/all`);
          pageUrl.searchParams.set("type",type === "movie" ? "1" : type === "episode" ? "4" : "2");
          pageUrl.searchParams.set("includeCollections","0");
          pageUrl.searchParams.set("includeExternalMedia","0");
          pageUrl.searchParams.set("X-Plex-Container-Start",String(start));
          pageUrl.searchParams.set("X-Plex-Container-Size","100");
          const body = record(await session.json(pageUrl,headers));
          const data = record(body?.MediaContainer);
          if (!data) session.error("UNREACHABLE");
          const rows = data.Metadata === undefined && nonNegativeInteger(data.size) === 0 ? [] : data.Metadata;
          if (!Array.isArray(rows)) session.error("UNREACHABLE");
          const size = nonNegativeInteger(data.size), total = data.totalSize === undefined ? null : nonNegativeInteger(data.totalSize);
          if ((data.size !== undefined && size !== rows.length) || (data.offset !== undefined && nonNegativeInteger(data.offset) !== start) || (data.totalSize !== undefined && (total === null || total < start+rows.length))) session.error("UNREACHABLE");
          if (!rows.length) { if (total !== null && start < total) session.error("UNREACHABLE"); break; }
          const fingerprint = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
          if (fingerprints.has(fingerprint)) session.error("UNREACHABLE");
          fingerprints.add(fingerprint);
          consumed += rows.length;
          if (consumed > 20_000) session.error("UNREACHABLE");
          for (const value of rows) {
            const metadata = record(value);
            if (!metadata) session.error("UNREACHABLE");
            if (typeof metadata.type !== "string") session.error("UNREACHABLE");
            if (!(recent ? ["movie","show","episode"] : ["movie","show"]).includes(metadata.type)) continue;
            const item = recent ? normalizePlexRecentItem(metadata,section.key,session) : normalizePlexItem(metadata,section.key,session);
            if (query.mediaType && item.mediaType !== query.mediaType) continue;
            if ("q" in query && !item.title.toLowerCase().includes(query.q.toLowerCase())) continue;
            const key = JSON.stringify([item.libraryKey,item.ratingKey]);
            if (!items.has(key)) items.set(key,item);
          }
          start += rows.length;
          if (total !== null && start >= total) break;
          // Without a reliable total, ask the next page even when fewer than 100 were returned.
        }
      }
    }
    const sorted = Array.from(items.values()).sort((a,b)=>{
      const first = recent ? (b.addedAt ? Date.parse(b.addedAt) : -Infinity) - (a.addedAt ? Date.parse(a.addedAt) : -Infinity) : a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      return first || a.libraryKey.localeCompare(b.libraryKey) || a.ratingKey.localeCompare(b.ratingKey);
    });
    return {items: sorted.slice(query.offset,query.offset+query.limit),pagination:{offset:query.offset,limit:query.limit,hasMore:sorted.length>query.offset+query.limit},source:"plex" as const};
  } finally { session.close(); }
}

export function normalizePlexItem(metadata: Record<string,unknown>, libraryKey: string, session: AgentSourceSession): AgentMediaItem {
  const ratingKey = identifier(metadata.ratingKey), title = optionalString(metadata.title);
  if (!ratingKey || !title) session.error("UNREACHABLE");
  const genres = Array.isArray(metadata.Genre) ? metadata.Genre.map(g=>optionalString(record(g)?.tag)).filter((g):g is string=>!!g) : [];
  return {ratingKey,libraryKey,title,mediaType:metadata.type === "show" ? "series" : "movie",year:nonNegativeInteger(metadata.year),summary:optionalString(metadata.summary),genres,addedAt:unixDate(metadata.addedAt)};
}

function civilDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value+"T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value : null;
}
function normalizePlexRecentItem(metadata: Record<string,unknown>, libraryKey: string, session: AgentSourceSession): AgentRecentItem {
  const base = normalizePlexItem(metadata,libraryKey,session);
  const episode = metadata.type === "episode";
  return {...base,mediaType:episode?"episode":base.mediaType,releaseDate:civilDate(metadata.originallyAvailableAt),
    seriesTitle:episode?optionalString(metadata.grandparentTitle):null,
    seasonNumber:episode?nonNegativeInteger(metadata.parentIndex):null,
    episodeNumber:episode?nonNegativeInteger(metadata.index):null};
}

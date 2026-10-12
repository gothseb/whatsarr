import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { SettingsService } from "../settings/settings.service";
import { AgentError } from "../agent/agent.types";
import { AgentSourceSession, record, identifier, nonNegativeInteger, optionalString, unixDate } from "../agent/agent-source";
import { AgentHistoryItem, AgentHistoryQuery } from "./tautulli.types";

interface HistoryEntry { item: AgentHistoryItem; time: number; rowId: bigint | null; ordinal: number }

@Injectable()
export class TautulliService {
  constructor(private readonly settings: SettingsService) {}

  async history(query: AgentHistoryQuery) {
    const config = await this.settings.getDecryptedService("tautulli");
    if (!config?.baseUrl || !config.apiKey) throw new AgentError(409,"TAUTULLI_NOT_CONFIGURED","Tautulli n’est pas configure.");
    let endpoint: URL;
    try {
      endpoint = new URL(config.baseUrl);
      endpoint.pathname = endpoint.pathname.replace(/\/+$/,"")+"/api/v2";
      endpoint.search = "";
      endpoint.hash = "";
    }
    catch { throw new AgentError(409,"TAUTULLI_NOT_CONFIGURED","URL Tautulli invalide."); }
    const from = query.from ? Date.parse(query.from) : null;
    const to = query.to ? Date.parse(query.to) : null;
    const result = (entries: HistoryEntry[]) => ({items: entries.slice(query.offset,query.offset+query.limit).map(entry=>entry.item), pagination:{offset:query.offset,limit:query.limit,hasMore:entries.length>query.offset+query.limit},source:"tautulli" as const});
    if (from !== null && to !== null && from === to) return result([]);
    const session: AgentSourceSession = new AgentSourceSession("TAUTULLI");
    const matches: HistoryEntry[] = [];
    const fingerprints = new Set<string>();
    let start = 0, previousTime = Infinity;
    try {
      for (let page = 0; ; page++) {
        if (page >= 200 || start >= 20_000) session.error("UNREACHABLE");
        const url = new URL(endpoint);
        // Query key supports older installed Tautulli versions; never logged or returned.
        url.searchParams.set("apikey",config.apiKey);
        url.searchParams.set("cmd","get_history");
        url.searchParams.set("grouping","0");
        url.searchParams.set("include_activity","0");
        url.searchParams.set("order_column","started");
        url.searchParams.set("order_dir","desc");
        url.searchParams.set("start",String(start));
        url.searchParams.set("length","100");
        if (query.userId !== undefined) url.searchParams.set("user_id",query.userId);
        const root = record(await session.json(url,{}));
        const response = record(root?.response);
        if (!response) session.error("UNREACHABLE");
        if (response.result !== "success") {
          if (typeof response.message === "string" && /(invalid.*api.?key|api.?key.*invalid|unauthori[sz]ed|authentication|api.?key.*(missing|provided|required))/i.test(response.message)) session.error("AUTHENTICATION_ERROR");
          session.error("UNREACHABLE");
        }
        const data = record(response.data);
        if (!data || !Array.isArray(data.data)) session.error("UNREACHABLE");
        const rows = data.data;
        const total = data.recordsFiltered === undefined ? null : nonNegativeInteger(data.recordsFiltered);
        if (data.recordsFiltered !== undefined && (total === null || total < start+rows.length)) session.error("UNREACHABLE");
        if (!rows.length) { if (total !== null && start < total) session.error("UNREACHABLE"); break; }
        const fingerprint = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
        if (fingerprints.has(fingerprint)) session.error("UNREACHABLE");
        fingerprints.add(fingerprint);
        if (start+rows.length > 20_000) session.error("UNREACHABLE");
        for (const [index, value] of rows.entries()) {
          const raw = record(value);
          if (!raw) session.error("UNREACHABLE");
          const item = normalizeHistory(raw);
          const time = item.startedAt ? Date.parse(item.startedAt) : -Infinity;
          if (time > previousTime) session.error("UNREACHABLE");
          previousTime = time;
          if (query.userId !== undefined && item.userId !== query.userId) continue;
          if ((from !== null || to !== null) && !item.startedAt) continue;
          if (from !== null && time < from || to !== null && time >= to) continue;
          const id = identifier(raw.row_id);
          matches.push({item,time,rowId:id && /^\d+$/.test(id)?BigInt(id):null,ordinal:start+index});
        }
        start += rows.length;
        matches.sort(compareHistory);
        if (total !== null && start >= total) break;
        // Exact UTC lower bound on a verified descending stream permits early termination.
        if (from !== null && previousTime < from) break;
        const needed = query.offset+query.limit+1;
        // Never stop inside a timestamp tie: the following pages may have higher row_ids.
        if (matches.length >= needed && previousTime < matches[needed-1].time) break;
      }
      return result(matches);
    } finally { session.close(); }
  }
}

function compareHistory(a: HistoryEntry, b: HistoryEntry) {
  if (a.time !== b.time) return a.time > b.time ? -1 : 1;
  if (a.rowId !== null && b.rowId !== null && a.rowId !== b.rowId) return a.rowId > b.rowId ? -1 : 1;
  if (a.rowId !== null && b.rowId === null) return -1;
  if (a.rowId === null && b.rowId !== null) return 1;
  return a.ordinal-b.ordinal;
}
function displayName(value: unknown): string | null {
  const name = optionalString(value);
  return name && !name.includes("@") ? name : null;
}
function normalizeHistory(raw: Record<string,unknown>): AgentHistoryItem {
  const type = ["movie","episode","track","live","collection","playlist"].includes(String(raw.media_type)) ? raw.media_type as AgentHistoryItem["mediaType"] : null;
  const progress = raw.percent_complete === null || raw.percent_complete === undefined || raw.percent_complete === "" ? NaN : typeof raw.percent_complete === "string" || typeof raw.percent_complete === "number" ? Number(raw.percent_complete) : NaN;
  return {userId:identifier(raw.user_id),userName:displayName(raw.friendly_name) ?? displayName(raw.user) ?? displayName(raw.username),
    title:optionalString(raw.title),mediaType:type,ratingKey:identifier(raw.rating_key),libraryKey:identifier(raw.section_id ?? raw.library_section_id),
    startedAt:unixDate(raw.started),stoppedAt:unixDate(raw.stopped),durationSeconds:nonNegativeInteger(raw.play_duration),
    progressPercent:Number.isFinite(progress) && progress>=0 && progress<=100 ? progress : null,
    seriesTitle:type === "episode" ? optionalString(raw.grandparent_title) : null,
    seasonNumber:type === "episode" ? nonNegativeInteger(raw.parent_media_index) : null,
    episodeNumber:type === "episode" ? nonNegativeInteger(raw.media_index) : null};
}

import { invalidRequest } from "./agent.dto";
import { pagination, scalarQuery } from "./agent-media.dto";
import { record } from "./agent-source";
export type ArrSource = "radarr" | "sonarr";
export interface ArrAdd {
    externalId: number;
    qualityProfileId: number;
    rootFolderId: number;
    tagIds: number[];
    monitored: boolean;
    search: boolean;
    seasonNumbers?: number[];
}
export function positive(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    invalidRequest(); return value; }
export function queryId(value: unknown): number { if (typeof value !== "string" || !/^[1-9]\d*$/.test(value))
    invalidRequest(); return positive(Number(value)); }
export function arrQuery(value: unknown) {
    const q = scalarQuery(value, ["q", "tagId", "monitored", "offset", "limit"]);
    if (q.q !== undefined && (!q.q.trim() || q.q.length > 200))
        invalidRequest();
    if (q.monitored !== undefined && !["true", "false"].includes(q.monitored))
        invalidRequest();
    return { ...pagination(q), q: q.q?.trim(), tagId: q.tagId === undefined ? undefined : queryId(q.tagId), monitored: q.monitored === undefined ? undefined : q.monitored === "true" };
}
export function addInput(value: unknown, source: ArrSource): ArrAdd {
    const b = record(value), key = source === "radarr" ? "tmdbId" : "tvdbId";
    if (!b || Object.keys(b).some(k => ![key, "qualityProfileId", "rootFolderId", "tagIds", "monitored", "search", ...(source === "sonarr" ? ["seasonNumbers"] : [])].includes(k)))
        invalidRequest();
    const ids = (v: unknown, min: number) => { if (!Array.isArray(v) || v.length > 100 || v.some(n => typeof n !== "number" || !Number.isSafeInteger(n) || n < min) || new Set(v).size !== v.length)
        invalidRequest(); return v as number[]; };
    for (const k of ["monitored", "search"])
        if (b[k] !== undefined && typeof b[k] !== "boolean")
            invalidRequest();
    return { externalId: positive(b[key]), qualityProfileId: positive(b.qualityProfileId), rootFolderId: positive(b.rootFolderId), tagIds: b.tagIds === undefined ? [] : ids(b.tagIds, 1), monitored: b.monitored === undefined ? true : b.monitored as boolean, search: b.search === true, ...(b.seasonNumbers === undefined ? {} : { seasonNumbers: ids(b.seasonNumbers, 0) }) };
}

import { Injectable, PipeTransform } from "@nestjs/common";
import { invalidRequest } from "./agent.dto";
import { record } from "./agent-source";
import { AgentCatalogueQuery, AgentMediaQuery, AgentRecentQuery } from "./agent-media.types";

export function scalarQuery(value: unknown, keys: string[]): Record<string,string> {
  const input = record(value);
  if (!input || Object.keys(input).some(key => !keys.includes(key) || typeof input[key] !== "string")) invalidRequest();
  return input as Record<string,string>;
}
export function pagination(query: Record<string,string>) {
  const number = (key: string, fallback: number) => {
    if (!(key in query)) return fallback;
    if (!/^(0|[1-9]\d*)$/.test(query[key])) invalidRequest();
    const value = Number(query[key]);
    if (!Number.isSafeInteger(value)) invalidRequest();
    return value;
  };
  const offset = number("offset",0), limit = number("limit",20);
  if (limit < 1 || limit > 100) invalidRequest();
  return {offset,limit};
}
@Injectable()
export class AgentCataloguePipe implements PipeTransform<unknown, AgentCatalogueQuery> {
  transform(value: unknown): AgentCatalogueQuery {
    const query = scalarQuery(value, ["libraryKey", "mediaType", "offset", "limit"]);
    if (query.libraryKey !== undefined && (!query.libraryKey.trim() || query.libraryKey.length > 256)) invalidRequest();
    if (query.mediaType !== undefined && !["movie", "series"].includes(query.mediaType)) invalidRequest();
    return { ...pagination(query), libraryKey: query.libraryKey?.trim(), mediaType: query.mediaType as AgentCatalogueQuery["mediaType"] };
  }
}
@Injectable()
export class AgentSearchPipe implements PipeTransform<unknown,AgentMediaQuery> {
  transform(value: unknown): AgentMediaQuery {
    const query = scalarQuery(value,["q","libraryKey","mediaType","offset","limit"]);
    if (!query.q?.trim() || query.q.trim().length > 200) invalidRequest();
    if (query.libraryKey !== undefined && (!query.libraryKey.trim() || query.libraryKey.length>256)) invalidRequest();
    if (query.mediaType !== undefined && !["movie","series"].includes(query.mediaType)) invalidRequest();
    return {q:query.q.trim(),...pagination(query),...(query.libraryKey!==undefined?{libraryKey:query.libraryKey}:{}),...(query.mediaType?{mediaType:query.mediaType as "movie"|"series"}:{})};
  }
}

@Injectable()
export class AgentRecentPipe implements PipeTransform<unknown,AgentRecentQuery> {
  transform(value: unknown): AgentRecentQuery {
    const query = scalarQuery(value,["libraryKey","mediaType","offset","limit"]);
    if (query.libraryKey !== undefined && (!query.libraryKey.trim() || query.libraryKey.length>256)) invalidRequest();
    if (query.mediaType !== undefined && !["movie","series","episode"].includes(query.mediaType)) invalidRequest();
    return {...pagination(query),...(query.libraryKey!==undefined?{libraryKey:query.libraryKey}:{}),...(query.mediaType?{mediaType:query.mediaType as AgentRecentQuery["mediaType"]}:{})};
  }
}

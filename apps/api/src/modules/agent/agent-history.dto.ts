import { Injectable, PipeTransform } from "@nestjs/common";
import { isISO8601 } from "class-validator";
import { invalidRequest } from "./agent.dto";
import { scalarQuery, pagination } from "./agent-media.dto";
import { AgentHistoryQuery } from "../tautulli/tautulli.types";

@Injectable()
export class AgentHistoryPipe implements PipeTransform<unknown,AgentHistoryQuery> {
  transform(value: unknown): AgentHistoryQuery {
    const query = scalarQuery(value,["userId","from","to","offset","limit"]);
    if (query.userId !== undefined && (!/^(0|[1-9]\d*)$/.test(query.userId) || query.userId.length > 128)) invalidRequest();
    for (const key of ["from","to"]) {
      const date = query[key];
      if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(date) || !isISO8601(date,{strict:true,strictSeparator:true}) || !Number.isFinite(Date.parse(date)))) invalidRequest();
    }
    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) invalidRequest();
    return {...pagination(query),...(query.userId!==undefined?{userId:query.userId}:{}),...(query.from?{from:query.from}:{}),...(query.to?{to:query.to}:{})};
  }
}

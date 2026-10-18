import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { AgentRequestsService } from "./agent-requests.service";
import { queryId } from "./agent-arr.dto";
import { scalarQuery } from "./agent-media.dto";
@Controller("agent/seerr/requests")
export class AgentRequestsController {
    constructor(
    @Inject(AgentRequestsService)
    private readonly requests: AgentRequestsService) { }
    @Get()
    list(
    @Query()
    q: unknown) { return this.requests.list(q); }
    @Get(":id")
    detail(
    @Param("id")
    id: string,
    @Query()
    q: unknown) { scalarQuery(q, []); return this.requests.detail(queryId(id)); }
}

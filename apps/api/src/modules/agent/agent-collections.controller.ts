import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { AgentService } from "./agent.service";
import { PlexService } from "../plex/plex.service";
import { AgentAvailabilityService } from "./agent-availability.service";
import { pagination, scalarQuery } from "./agent-media.dto";
import { queryId } from "./agent-arr.dto";
import { invalidRequest } from "./agent.dto";
@Controller("agent/media")
export class AgentCollectionsController {
    constructor(
    @Inject(AgentService)
    private readonly agent: AgentService,
    @Inject(PlexService)
    private readonly plex: PlexService,
    @Inject(AgentAvailabilityService)
    private readonly availability: AgentAvailabilityService) { }
    private query(value: unknown) { const q = scalarQuery(value, ["libraryKey", "q", "offset", "limit"]); if (q.libraryKey !== undefined && (!q.libraryKey.trim() || q.libraryKey.length > 256) || q.q !== undefined && (!q.q.trim() || q.q.length > 200))
        invalidRequest(); return { ...pagination(q), libraryKey: q.libraryKey, q: q.q?.trim() }; }
    @Get("collections")
    async collections(
    @Query()
    value: unknown) { const q = this.query(value); return this.plex.collections(q, await this.agent.recapLibraries(q.libraryKey)); }
    @Get("collections/:id/items")
    async items(
    @Param("id")
    id: string,
    @Query()
    value: unknown) { queryId(id); const q = this.query(value); return this.plex.collections(q, await this.agent.recapLibraries(q.libraryKey), id); }
    @Get("availability")
    check(
    @Query()
    value: unknown) { const q = scalarQuery(value, ["mediaType", "tmdbId", "tvdbId"]); if (!["movie", "series"].includes(q.mediaType) || q.mediaType === "movie" && q.tvdbId !== undefined || q.mediaType === "series" && q.tmdbId !== undefined)
        invalidRequest(); return this.availability.check(q.mediaType as "movie" | "series", queryId(q.mediaType === "movie" ? q.tmdbId : q.tvdbId)); }
}

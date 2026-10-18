import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import type { AgentRequest } from "./agent-exception.filter";
import { AgentArrService } from "./agent-arr.service";
import { addInput, arrQuery, ArrSource, queryId } from "./agent-arr.dto";
import { scalarQuery } from "./agent-media.dto";
import { AgentError } from "./agent.types";
@Controller("agent")
export class AgentArrController {
    constructor(
    @Inject(AgentArrService)
    private readonly arr: AgentArrService) { }
    private source(value: string): ArrSource { if (value !== "radarr" && value !== "sonarr")
        throw new AgentError(404, "NOT_FOUND", "Service introuvable."); return value; }
    @Get("radarr/movies")
    movies(
    @Query()
    q: unknown) { return this.arr.list("radarr", arrQuery(q)); }
    @Get("sonarr/series")
    series(
    @Query()
    q: unknown) { return this.arr.list("sonarr", arrQuery(q)); }
    @Get(":source/tags")
    tags(
    @Param("source")
    source: string,
    @Query()
    q: unknown) { scalarQuery(q, []); return this.arr.tags(this.source(source)); }
    @Get(":source/options")
    options(
    @Param("source")
    source: string,
    @Query()
    q: unknown) { scalarQuery(q, []); return this.arr.options(this.source(source)); }
    @Get(":source/lookup")
    lookup(
    @Param("source")
    value: string,
    @Query()
    valueQuery: unknown) { const source = this.source(value), key = source === "radarr" ? "tmdbId" : "tvdbId", q = scalarQuery(valueQuery, [key]); return this.arr.lookup(source, queryId(q[key])); }
    @Post("radarr/movies")
    addMovie(
    @Body()
    body: unknown,
    @Req()
    req: AgentRequest,
    @Res({ passthrough: true })
    res: Response) { return this.add("radarr", body, req, res); }
    @Post("sonarr/series")
    addSeries(
    @Body()
    body: unknown,
    @Req()
    req: AgentRequest,
    @Res({ passthrough: true })
    res: Response) { return this.add("sonarr", body, req, res); }
    private async add(source: ArrSource, body: unknown, req: AgentRequest, res: Response) { const result = await this.arr.add(source, addInput(body, source), req.agentRequestId); res.status(result.deduplicated ? 200 : 201); return result; }
}

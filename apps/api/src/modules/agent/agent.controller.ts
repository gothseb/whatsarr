import { AgentHistoryPipe } from "./agent-history.dto";
import { AgentHistoryQuery } from "../tautulli/tautulli.types";
import { AgentCataloguePipe, AgentSearchPipe, AgentRecentPipe } from "./agent-media.dto";
import { AgentCatalogueQuery, AgentMediaQuery, AgentRecentQuery } from "./agent-media.types";
import { Body, Controller, Get, Inject, Param, Query, Post, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { AgentService } from "./agent.service";
import { AgentMessagePipe } from "./agent.dto";
import type { AgentMessage } from "./agent.types";
import type { AgentRequest } from "./agent-exception.filter";
import { hermesOpenApi } from "./hermes-openapi";

@Controller("agent")
export class AgentController {
  constructor(@Inject(AgentService) private readonly agent: AgentService) {}

  @Post("messages")
  async submit(@Body(AgentMessagePipe) message: AgentMessage, @Req() request: AgentRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.agent.submit(message, request.agentRequestId);
    response.status(result.deduplicated ? 200 : 202);
    return result;
  }

  @Get("media/search")
  search(@Query(AgentSearchPipe) query: AgentMediaQuery) { return this.agent.search(query); }

  @Get("media/catalogue")
  catalogue(@Query(AgentCataloguePipe) query: AgentCatalogueQuery) { return this.agent.catalogue(query); }

  @Get("media/recent")
  recent(@Query(AgentRecentPipe) query: AgentRecentQuery) { return this.agent.recent(query); }

  @Get("watch-history")
  history(@Query(AgentHistoryPipe) query: AgentHistoryQuery) { return this.agent.history(query); }

  @Get("openapi.json")
  openapi() { return hermesOpenApi; }

  @Get("messages/:jobId")
  status(@Param("jobId") jobId: string) { return this.agent.status(jobId); }
}

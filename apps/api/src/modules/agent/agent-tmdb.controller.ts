import { Controller, Get, Inject, Query } from "@nestjs/common";
import { AgentTmdbService } from "./agent-tmdb.service";
import { tmdbCatalogue } from "./tmdb-catalogue";

@Controller("agent/tmdb")
export class AgentTmdbController {
  constructor(@Inject(AgentTmdbService) private readonly tmdb: AgentTmdbService) {}

  @Get("catalogue")
  catalogue() { return { source: "tmdb", version: "3", method: "GET", routes: tmdbCatalogue }; }

  @Get()
  query(@Query() query: Record<string, unknown>) { return this.tmdb.query(query); }
}

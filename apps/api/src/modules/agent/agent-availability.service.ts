import { Injectable } from "@nestjs/common";
import { AgentArrService } from "./agent-arr.service";
import { AgentService } from "./agent.service";
import { PlexService } from "../plex/plex.service";
import { AgentError } from "./agent.types";
@Injectable()
export class AgentAvailabilityService {
    constructor(private readonly arr: AgentArrService, private readonly agent: AgentService, private readonly plex: PlexService) { }
    async check(type: "movie" | "series", id: number) {
        const safe = async <T>(read: () => Promise<T>) => { try {
            return await read();
        }
        catch (error) {
            return { state: "unknown" as const, error: { code: error instanceof AgentError ? error.code : "SOURCE_UNAVAILABLE" } };
        } };
        const [arr, plex] = await Promise.all([safe(() => this.arr.presence(type === "movie" ? "radarr" : "sonarr", id)), safe(async () => this.plex.availability(type, id, await this.agent.recapLibraries()))]);
        return { mediaType: type, ...(type === "movie" ? { tmdbId: id } : { tvdbId: id }), arr, plex };
    }
}

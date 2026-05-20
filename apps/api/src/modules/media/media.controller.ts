import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { MediaAvailabilityDto, RecentWindowDto } from "./media.dto";
import { MediaService } from "./media.service";

@UseGuards(AuthGuard)
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get("recent-window")
  getRecentWindow() {
    return this.media.getRecentWindow();
  }

  @Put("recent-window")
  updateRecentWindow(@Body() payload: RecentWindowDto) {
    return this.media.updateRecentWindow(payload.months);
  }

  @Post("availability")
  routeAvailability(@Body() payload: MediaAvailabilityDto) {
    return this.media.routeAvailability(payload);
  }

  @Post("request-available")
  notifyRequestAvailable(@Body() payload: MediaAvailabilityDto) {
    return this.media.notifyRequestAvailable(payload);
  }

  @Post("new-episode")
  notifyNewEpisode(@Body() payload: MediaAvailabilityDto) {
    return this.media.notifyNewEpisode(payload);
  }
}

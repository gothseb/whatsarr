import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { NotificationsService } from "./notifications.service";

@UseGuards(AuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("jobs")
  listJobs(@Query("limit") limit?: string) {
    return this.notifications.listJobs(Number(limit) || 50);
  }

  @Post("jobs/process")
  async processJobs() {
    await this.notifications.processDueJobs();
    return { ok: true };
  }

  @Post("jobs/:id/retry")
  retryJob(@Param("id") id: string) {
    return this.notifications.retryJob(id);
  }

  @Get("logs")
  listLogs(@Query("limit") limit?: string) {
    return this.notifications.listLogs(Number(limit) || 80);
  }
}

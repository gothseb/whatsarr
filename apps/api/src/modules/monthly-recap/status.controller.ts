import { Controller, Get, Sse, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { StatusService } from "./status.service";

@UseGuards(AuthGuard)
@Controller("status")
export class StatusController {
  constructor(private readonly status: StatusService) {}

  @Get()
  getStatus() {
    return this.status.getCurrentStatus();
  }

  @Sse("events")
  streamEvents() {
    return this.status.stream();
  }
}

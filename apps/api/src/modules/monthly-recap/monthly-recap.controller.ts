import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import {
  RunMonthlyRecapDto,
  UpdateMonthlyRecapScheduleDto,
  UpdateMonthlyRecapLibrariesDto
} from "./monthly-recap.dto";
import { MonthlyRecapService } from "./monthly-recap.service";

@UseGuards(AuthGuard)
@Controller("monthly-recap")
export class MonthlyRecapController {
  constructor(private readonly monthlyRecap: MonthlyRecapService) {}

  @Get("libraries")
  listLibraries() {
    return this.monthlyRecap.listLibraries();
  }

  @Put("libraries")
  updateLibraries(@Body() payload: UpdateMonthlyRecapLibrariesDto) {
    return this.monthlyRecap.updateLibraries(
      payload.includedLibraryKeys,
      payload.notificationLibraryKeys
    );
  }

  @Get("status")
  getStatus() {
    return this.monthlyRecap.getLatestStatus();
  }

  @Get("schedule")
  getSchedule() {
    return this.monthlyRecap.getSchedule();
  }

  @Put("schedule")
  updateSchedule(@Body() payload: UpdateMonthlyRecapScheduleDto) {
    return this.monthlyRecap.updateSchedule(payload.dayOfMonth, payload.time);
  }

  @Post("run")
  run(@Body() payload: RunMonthlyRecapDto) {
    return this.monthlyRecap.runMonthlyRecap(payload.referenceDate, true, payload.send ?? false);
  }
}

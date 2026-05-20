import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { ConnectionTestService } from "./connection-test.service";
import { SettingsService } from "./settings.service";
import { UpdateServiceSettingsDto } from "./settings.dto";

@UseGuards(AuthGuard)
@Controller("settings/services")
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly connectionTests: ConnectionTestService
  ) {}

  @Get()
  listServices() {
    return this.settings.listServices();
  }

  @Put(":serviceKey")
  updateService(
    @Param("serviceKey") serviceKey: string,
    @Body() payload: UpdateServiceSettingsDto
  ) {
    return this.settings.updateService(serviceKey, payload);
  }

  @Post(":serviceKey/test")
  testService(@Param("serviceKey") serviceKey: string) {
    return this.connectionTests.test(serviceKey);
  }
}

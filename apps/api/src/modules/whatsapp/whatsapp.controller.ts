import { Body, Controller, Get, Post, Put, Sse, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { ConnectWhatsAppDto, SelectServerGroupDto } from "./whatsapp.dto";
import { WhatsAppService } from "./whatsapp.service";

@UseGuards(AuthGuard)
@Controller("whatsapp")
export class WhatsAppController {
  constructor(private readonly whatsApp: WhatsAppService) {}

  @Get("status")
  getStatus() {
    return this.whatsApp.getStatus();
  }

  @Sse("events")
  streamEvents() {
    return this.whatsApp.stream();
  }

  @Post("connect")
  connect(@Body() payload: ConnectWhatsAppDto) {
    return this.whatsApp.connect(Boolean(payload.replaceExistingSession));
  }

  @Get("groups")
  listGroups() {
    return this.whatsApp.listGroups();
  }

  @Post("groups/refresh")
  refreshGroups() {
    return this.whatsApp.refreshGroups();
  }

  @Get("server-group")
  getServerGroup() {
    return this.whatsApp.getServerGroup();
  }

  @Put("server-group")
  selectServerGroup(@Body() payload: SelectServerGroupDto) {
    return this.whatsApp.selectServerGroup(
      payload.groupId,
      payload.name,
      Boolean(payload.confirmReplace)
    );
  }

  @Get("members")
  listMembers() {
    return this.whatsApp.listMembers();
  }

  @Post("members/import")
  importMembers() {
    return this.whatsApp.importServerGroupMembers();
  }
}

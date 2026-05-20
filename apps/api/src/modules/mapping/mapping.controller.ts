import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CreateUserContactMappingDto } from "./mapping.dto";
import { MappingService } from "./mapping.service";

@UseGuards(AuthGuard)
@Controller("mapping")
export class MappingController {
  constructor(private readonly mapping: MappingService) {}

  @Get()
  getState() {
    return this.mapping.getState();
  }

  @Post("plex-users/import")
  importPlexUsers() {
    return this.mapping.importPlexUsers();
  }

  @Post("links")
  createMapping(@Body() payload: CreateUserContactMappingDto) {
    return this.mapping.createMapping(payload.plexUserId, payload.whatsappId);
  }

  @Delete("links/:id")
  deleteMapping(@Param("id") id: string) {
    return this.mapping.deleteMapping(id);
  }
}

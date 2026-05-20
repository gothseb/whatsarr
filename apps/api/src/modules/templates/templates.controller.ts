import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PreviewTemplateDto, UpdateTemplateDto } from "./templates.dto";
import { TemplatesService } from "./templates.service";

@UseGuards(AuthGuard)
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  listTemplates() {
    return this.templates.listTemplates();
  }

  @Put(":type")
  updateTemplate(@Param("type") type: string, @Body() payload: UpdateTemplateDto) {
    return this.templates.updateTemplate(type, payload.body);
  }

  @Post(":type/preview")
  preview(@Param("type") type: string, @Body() payload: PreviewTemplateDto) {
    return this.templates.preview(type, payload.body, payload.variables);
  }
}

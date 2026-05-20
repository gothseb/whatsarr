import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "whatsarr",
      timestamp: new Date().toISOString()
    };
  }
}

import { Body, Controller, Inject, Post, Req, HttpCode } from "@nestjs/common";
import { AgentRelayPipe, AgentRelayRequest } from "./agent-relay.dto";
import { AgentRelayService } from "./agent-relay.service";
import { AgentRequest } from "./agent-exception.filter";

@Controller("agent")
export class AgentRelayController {
  constructor(@Inject(AgentRelayService) private readonly relayService: AgentRelayService) {}
  @Post("relay")
  @HttpCode(200)
  relay(@Body(AgentRelayPipe) body: AgentRelayRequest, @Req() request: AgentRequest) {
    return this.relayService.relay(body,request.agentRequestId);
  }
}

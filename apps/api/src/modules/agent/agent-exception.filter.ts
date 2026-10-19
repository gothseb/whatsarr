import { json } from "express";
import { relayLimit } from "./agent-relay.service";
import { ArgumentsHost, Catch, HttpException, INestApplication } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { AgentError } from "./agent.types";

export type AgentRequest = Request & { agentRequestId: string };
export function isAgentPath(request: Request) {
  return /^\/api\/agent(?:\/|\?|$)/i.test(request.originalUrl);
}

@Catch()
export class AgentExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<AgentRequest>();
    if (!isAgentPath(request)) return super.catch(exception, host);
    const response = host.switchToHttp().getResponse<Response>();
    const httpStatus = exception instanceof HttpException ? exception.getStatus() :
      (exception as { status?: number })?.status;
    const status = exception instanceof AgentError ? exception.getStatus() :
      httpStatus === 400 ? 400 : httpStatus === 404 ? 404 : httpStatus === 413 ? 413 : 500;
    const code = exception instanceof AgentError ? exception.code :
      status === 400 || status === 413 ? "AGENT_INVALID_REQUEST" : status === 404 ? "AGENT_ROUTE_NOT_FOUND" : "AGENT_INTERNAL_ERROR";
    const message = exception instanceof AgentError ? exception.message :
      status === 500 ? "Erreur interne de Whatsarr." : "Requete agent invalide.";
    response.status(status).json({ error: { code, message, requestId: request.agentRequestId ?? randomUUID() } });
  }
}

// Register before app.init/listen, so correlation exists even when JSON parsing fails.
export function configureAgentHttp(app: INestApplication) {
  app.use((request: AgentRequest, _response: Response, next: NextFunction) => {
    if (isAgentPath(request)) request.agentRequestId = randomUUID();
    next();
  });
  // Installed before Nest's default parser; Express skips an already-consumed relay body.
  const relayParser = json({ limit: relayLimit("RELAY_MAX_REQUEST_BYTES", 10 * 1024 * 1024), strict: true });
  app.use((request: AgentRequest, response: Response, next: NextFunction) => {
    if (request.method === "POST" && /^\/api\/agent\/relay\/?(?:\?|$)/i.test(request.originalUrl)) relayParser(request, response, next);
    else next();
  });
  app.useGlobalFilters(new AgentExceptionFilter(app.getHttpAdapter()));
}

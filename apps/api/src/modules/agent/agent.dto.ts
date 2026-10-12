import { Injectable, PipeTransform } from "@nestjs/common";
import { isImageUrl } from "./agent-image.service";
import { AgentError, AgentMessage } from "./agent.types";

export function invalidRequest(): never {
  throw new AgentError(400, "AGENT_INVALID_REQUEST", "Parametres de requete invalides.");
}

@Injectable()
export class AgentMessagePipe implements PipeTransform<unknown, AgentMessage> {
  transform(value: unknown): AgentMessage {
    if (!value || typeof value !== "object" || Array.isArray(value)) invalidRequest();
    const body = value as Record<string, unknown>;
    if (Object.keys(body).some(key => !["messageId", "text", "imageUrl"].includes(key))) invalidRequest();
    for (const [key, max] of [["messageId", 128], ["text", "imageUrl" in body ? 1000 : 4000]] as const) {
      const field = body[key];
      if (typeof field !== "string" || !field.trim() || field.length > max) invalidRequest();
    }
    if ("imageUrl" in body && !isImageUrl(body.imageUrl)) invalidRequest();
    return { ...("imageUrl" in body ? {imageUrl: body.imageUrl as string} : {}), messageId: body.messageId as string, text: body.text as string };
  }
}

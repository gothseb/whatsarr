import { HttpException } from "@nestjs/common";

export class AgentError extends HttpException {
  constructor(status: number, public readonly code: string, message: string) {
    super(message, status);
  }
}

export interface AgentMessage {
  messageId: string;
  text: string;
  imageUrl?: string;
}

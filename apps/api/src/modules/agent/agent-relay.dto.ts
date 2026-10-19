import { Injectable, PipeTransform } from "@nestjs/common";
import { MediaServiceKey, isMediaService } from "../settings/settings.constants";
import { invalidRequest } from "./agent.dto";

export const relayMethods = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"] as const;
export type RelayScalar = string | number | boolean;
export interface AgentRelayRequest {
  service: MediaServiceKey;
  method: typeof relayMethods[number];
  path: string;
  query?: Record<string, RelayScalar | RelayScalar[]>;
  headers?: Record<string, string>;
  body?: unknown;
  bodyEncoding?: "json" | "text" | "base64";
}
export const sensitiveName = (key: string) => /^(?:apikey|xapikey|xplextoken|authorization|proxyauthorization|password|passwd|clientsecret|secret|cookie|setcookie)$/i.test(key.replace(/[-_\s]/g, ""));
const reservedQueryName = (key: string) => /^(?:apikey|xapikey|xplextoken|authorization|proxyauthorization)$/i.test(key.replace(/[-_\s]/g, ""));
const transportHeader = /^(?:host|connection|content-length|transfer-encoding|keep-alive|te|trailer|upgrade|expect|accept-encoding|proxy-.*|forwarded|x-forwarded-.*|content-encoding)$/i;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const scalar = (value: unknown): value is RelayScalar => typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);

@Injectable()
export class AgentRelayPipe implements PipeTransform<unknown, AgentRelayRequest> {
  transform(input: unknown): AgentRelayRequest {
    if (!record(input) || Object.keys(input).some(key => !["service", "method", "path", "query", "headers", "body", "bodyEncoding"].includes(key))) invalidRequest();
    const service = input.service === "seerr" ? "overseerr" : input.service;
    if (typeof service !== "string" || !isMediaService(service) || !relayMethods.includes(input.method as never)) invalidRequest();
    if (typeof input.path !== "string" || !input.path.startsWith("/") || input.path.length > 8192) invalidRequest();
    if (input.query !== undefined && (!record(input.query) || Object.entries(input.query).some(([key, value]) => !key || reservedQueryName(key) || /[\x00-\x1f\x7f]/.test(key) || !(scalar(value) || Array.isArray(value) && value.every(scalar))))) invalidRequest();
    if (input.headers !== undefined && (!record(input.headers) || Object.entries(input.headers).some(([key, value]) => !/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(key) || sensitiveName(key) || transportHeader.test(key) || typeof value !== "string" || /[\x00-\x1f\x7f\u0100-\uffff]/.test(value)))) invalidRequest();
    if (input.bodyEncoding !== undefined && !["json", "text", "base64"].includes(input.bodyEncoding as string)) invalidRequest();
    if ((input.method === "GET" || input.method === "HEAD") && Object.hasOwn(input, "body")) invalidRequest();
    if (input.bodyEncoding !== undefined && !Object.hasOwn(input, "body")) invalidRequest();
    if (input.bodyEncoding === "text" && typeof input.body !== "string") invalidRequest();
    if (input.bodyEncoding === "base64" && (typeof input.body !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.body) || Buffer.from(input.body,"base64").toString("base64") !== input.body)) invalidRequest();
    return { ...input, service } as unknown as AgentRelayRequest;
  }
}

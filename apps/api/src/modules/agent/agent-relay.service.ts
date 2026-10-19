import { Inject, Injectable } from "@nestjs/common";
import { SettingsService } from "../settings/settings.service";
import { MEDIA_SERVICES } from "../settings/settings.constants";
import { AgentRelayRequest } from "./agent-relay.dto";
import { RelayRedactor } from "./agent-relay-redaction";
import { AgentError } from "./agent.types";

export function relayLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647 ? value : fallback;
}
// Decode repeatedly before checking boundaries; never allow encoded traversal, origins or separators.
function safePath(path: string): boolean {
  if (/\s/.test(path) || /%(?![a-f\d]{2})/i.test(path)) return false;
  let decoded = path;
  for (let depth=0;depth<8;depth++) {
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\?#\x00-\x1f\x7f]/.test(decoded) || decoded.split("/").some(part=>part===".." || part===".")) return false;
    // Validate raw percent triples once. A decoded literal '%' may then coexist with
    // other escapes: continue decoding those ASCII triples to detect hidden traversal.
    const next = decoded.replace(/%([a-f\d]{2})/gi, (escape,hex: string) => {
      const byte = Number.parseInt(hex,16);
      return byte < 128 ? String.fromCharCode(byte) : escape;
    });
    if (next === decoded) return true;
    decoded = next;
  }
  return false;
}
function targetUrl(baseUrl: string, path: string): URL {
  if (!safePath(path)) throw new AgentError(400,"AGENT_INVALID_REQUEST","Chemin natif invalide.");
  let base: URL;
  try { base = new URL(baseUrl); } catch { throw new AgentError(409,"RELAY_NOT_CONFIGURED","URL du service invalide."); }
  if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash || !safePath(base.pathname)) throw new AgentError(409,"RELAY_NOT_CONFIGURED","URL du service invalide.");
  const prefix = base.pathname.replace(/\/+$/,"");
  const url = new URL(base.origin + prefix + path);
  if (url.origin !== base.origin || prefix && !url.pathname.startsWith(prefix+"/")) throw new AgentError(400,"AGENT_INVALID_REQUEST","Chemin hors du service configuré.");
  return url;
}

@Injectable()
export class AgentRelayService {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  async relay(request: AgentRelayRequest, requestId: string) {
    // All stored credentials are masked, even when an upstream configuration reflects another service.
    const configurations = await Promise.all(MEDIA_SERVICES.map(service=>this.settings.getDecryptedService(service)));
    const config = configurations[MEDIA_SERVICES.indexOf(request.service)];
    if (!config?.apiKey?.trim() || request.service !== "tmdb" && !config.baseUrl) throw new AgentError(409,"RELAY_NOT_CONFIGURED","Configurez l’URL et la clé du service dans Paramètres.");
    const secrets = configurations.flatMap(item=>item ? [item.apiKey,item.password].filter((value):value is string=>Boolean(value)) : [])
      .flatMap(secret=>[secret,secret.trim(),secret.trim().replace(/^Bearer\s+/i,"")]);
    const apiKey = config.apiKey.trim().replace(/^Bearer\s+/i,"");
    secrets.push(apiKey);
    const redactor = new RelayRedactor(secrets);
    const url = targetUrl(request.service === "tmdb" ? "https://api.themoviedb.org" : config.baseUrl!, request.path);
    if (request.service === "tmdb" && !/^\/(?:3|4)(?:\/|$)/.test(url.pathname)) throw new AgentError(400,"AGENT_INVALID_REQUEST","TMDB requiert un chemin natif /3 ou /4.");
    for (const [name,value] of Object.entries(request.query ?? {})) for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(name,String(item));
    const headers = new Headers(request.headers);
    if (request.service === "plex") headers.set("X-Plex-Token",apiKey);
    else if (request.service === "tautulli") url.searchParams.set("apikey",apiKey);
    else if (request.service === "tmdb") {
      if (/^[a-f\d]{32}$/i.test(apiKey)) url.searchParams.set("api_key",apiKey);
      else headers.set("Authorization",`Bearer ${apiKey}`);
    } else headers.set("X-Api-Key",apiKey);
    let body: string | ArrayBuffer | undefined;
    if (Object.hasOwn(request,"body")) {
      if (request.bodyEncoding === "base64") body = Uint8Array.from(Buffer.from(request.body as string,"base64")).buffer;
      else if (request.bodyEncoding === "text") body = request.body as string;
      else body = JSON.stringify(request.body);
      if (!headers.has("content-type")) headers.set("content-type",request.bodyEncoding === "base64" ? "application/octet-stream" : request.bodyEncoding === "text" ? "text/plain; charset=utf-8" : "application/json");
    }
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),relayLimit("RELAY_TIMEOUT_MS",30_000));
    try {
      const response = await fetch(url,{method:request.method,headers,body,redirect:"manual",signal:controller.signal});
      const maxBytes = relayLimit("RELAY_MAX_RESPONSE_BYTES",32*1024*1024);
      const declaredLength = Number(response.headers.get("content-length"));
      if (request.method !== "HEAD" && response.status !== 304 && response.status !== 204 && declaredLength>maxBytes) { await response.body?.cancel(); throw new AgentError(413,"RELAY_RESPONSE_TOO_LARGE","La réponse du service dépasse la limite configurée."); }
      const chunks: Buffer[] = []; let bytes = 0;
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const chunk = await reader.read(); if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes>maxBytes) { await reader.cancel(); throw new AgentError(413,"RELAY_RESPONSE_TOO_LARGE","La réponse du service dépasse la limite configurée."); }
            chunks.push(Buffer.from(chunk.value));
          }
        } finally { reader.releaseLock(); }
      }
      const payload = Buffer.concat(chunks);
      let result: unknown = null;
      let bodyEncoding: "json" | "text" | "base64" | "empty" = "empty";
      if (payload.length && request.method !== "HEAD") {
        const contentType = response.headers.get("content-type") ?? "";
        const isJson = /(?:^application\/(?:[\w.-]+\+)?json\b)/i.test(contentType);
        const isText = /^(?:text\/|application\/(?:[\w.-]+\+)?xml\b|application\/javascript\b|application\/x-www-form-urlencoded\b)/i.test(contentType);
        let decoded: string | undefined;
        if (isJson || isText) {
          const charset = isJson ? "utf-8" : /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1] ?? "utf-8";
          try { decoded = new TextDecoder(charset,{fatal:true}).decode(payload); } catch { /* Preserve unsupported/invalid encodings as bytes. */ }
        }
        if (decoded !== undefined) {
          result=decoded;bodyEncoding="text";
          if (isJson) { try { result=JSON.parse(decoded);bodyEncoding="json"; } catch { /* Native malformed JSON is still readable text. */ } }
        } else { redactor.binary(payload); result=payload.toString("base64");bodyEncoding="base64"; }
        if (bodyEncoding === "json") result=redactor.json(result);
        if (bodyEncoding === "text") result=redactor.text(result as string);
      }
      const publicHeaders = redactor.headers(response.headers);
      return {service:request.service,upstreamStatus:response.status,headers:publicHeaders,body:result,bodyEncoding,redacted:redactor.redacted,requestId};
    } catch (error) {
      if (error instanceof AgentError) throw error;
      if (controller.signal.aborted) throw new AgentError(504,"RELAY_TIMEOUT","Délai du relais dépassé. Une écriture peut avoir été appliquée : vérifiez son état avant de la répéter.");
      throw new AgentError(502,"RELAY_UPSTREAM_ERROR","Échec du transport vers le service. Une écriture peut avoir été appliquée : vérifiez son état avant de la répéter.");
    } finally { clearTimeout(timer); }
  }
}

import { AgentError } from "./agent.types";

/** One deadline for all pages; bounded bodies, no source error text or credentials escape. */
export class AgentSourceSession {
  private readonly controller = new AbortController();
  private readonly deadline = Date.now() + 15_000;
  private readonly timer = setTimeout(() => this.controller.abort(), 15_000);
  private bytes = 0;
  constructor(private readonly source: "PLEX" | "TAUTULLI" | "TMDB" | "RADARR" | "SONARR" | "SEERR") {}

  error(kind: "UNREACHABLE" | "TIMEOUT" | "AUTHENTICATION_ERROR"): never {
    throw new AgentError(kind === "TIMEOUT" ? 504 : 502, `${this.source}_${kind}`, `${this.source} : ${kind === "TIMEOUT" ? "delai de lecture depasse" : kind === "AUTHENTICATION_ERROR" ? "identifiants refuses" : "reponse inaccessible ou inexploitable"}.`);
  }
  close() { clearTimeout(this.timer); this.controller.abort(); }

  async json(url: URL, headers: Record<string,string>, body?: unknown): Promise<unknown> {
    let response: Response | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const cancel = () => { void reader?.cancel().catch(() => undefined); };
    this.controller.signal.addEventListener("abort", cancel);
    try {
      this.checkDeadline();
      response = await fetch(url, { method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body), headers: {Accept:"application/json", ...(body === undefined ? {} : {"Content-Type":"application/json"}), ...headers}, redirect: "error", signal: this.controller.signal });
      if ([401,403].includes(response.status)) this.error("AUTHENTICATION_ERROR");
      if (["RADARR","SONARR","SEERR"].includes(this.source) && [400,404,409,422,429].includes(response.status)) {
        const suffix=response.status===404?"NOT_FOUND":response.status===429?"RATE_LIMITED":"BAD_REQUEST";
        throw new AgentError(response.status,`${this.source}_${suffix}`,`${this.source} : requête refusée.`);
      }
      if (this.source === "TMDB" && [400, 404, 429].includes(response.status)) {
        const codes: Record<number, string> = { 400: "TMDB_BAD_REQUEST", 404: "TMDB_NOT_FOUND", 429: "TMDB_RATE_LIMITED" };
        throw new AgentError(response.status, codes[response.status], response.status === 429 ? "Limite TMDB atteinte. Réessayez plus tard." : response.status === 404 ? "Ressource TMDB introuvable." : "Paramètres refusés par TMDB.");
      }
      if (!response.ok || !response.body || Number(response.headers.get("content-length")) > 4*1024*1024) this.error("UNREACHABLE");
      reader = response.body.getReader();
      let size = 0;
      const chunks: Buffer[] = [];
      while (true) {
        const result = await reader.read();
        this.checkDeadline();
        if (result.done) break;
        size += result.value.byteLength;
        this.bytes += result.value.byteLength;
        if (size > 4*1024*1024 || this.bytes > 32*1024*1024) this.error("UNREACHABLE");
        chunks.push(Buffer.from(result.value));
      }
      const parsed: unknown = JSON.parse(Buffer.concat(chunks,size).toString("utf8"));
      this.checkDeadline();
      return parsed;
    } catch (error) {
      if (this.controller.signal.aborted || Date.now() >= this.deadline) this.error("TIMEOUT");
      if (error instanceof AgentError) throw error;
      this.error("UNREACHABLE");
    } finally {
      this.controller.signal.removeEventListener("abort",cancel);
      if (reader) { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      else await response?.body?.cancel().catch(() => undefined);
    }
  }

  private checkDeadline() {
    if (this.controller.signal.aborted || Date.now() >= this.deadline) this.error("TIMEOUT");
  }
}

export function record(value: unknown): Record<string,unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : null;
}
export function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
export function identifier(value: unknown): string | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? String(value) : optionalString(value);
}
export function nonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function unixDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds*1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

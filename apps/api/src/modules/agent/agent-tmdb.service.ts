import { Inject, Injectable } from "@nestjs/common";
import { SettingsService } from "../settings/settings.service";
import { AgentError } from "./agent.types";
import { AgentSourceSession, record } from "./agent-source";
import { tmdbCatalogue, TmdbRoute } from "./tmdb-catalogue";

function invalid(): never {
  throw new AgentError(400, "AGENT_INVALID_REQUEST", "Chemin ou paramètres TMDB invalides. Consultez /api/agent/tmdb/catalogue.");
}

export function matchTmdbRoute(path: string): TmdbRoute | undefined {
  if (path.length > 400 || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path)) return undefined;
  const parts = path.split("/");
  return tmdbCatalogue.find((route) => {
    const template = route.path.split("/");
    return parts.length === template.length && template.every((part, index) => {
      if (!part.startsWith("{")) return part === parts[index];
      const parameter = route.parameters.find((p) => p.in === "path" && p.name === part.slice(1, -1));
      return parameter !== undefined && validValue(parts[index], parameter.schema) && (parameter.schema.type !== "integer" || /^(0|[1-9]\d*)$/.test(parts[index]));
    });
  });
}

function validValue(value: string, schema: TmdbRoute["parameters"][number]["schema"]): boolean {
  if (schema.enum && !schema.enum.some((option) => String(option) === value)) return false;
  if (schema.type === "boolean") return value === "true" || value === "false";
  if (schema.type === "integer" || schema.type === "number") {
    if (!/^-?\d+(?:\.\d+)?$/.test(value)) return false;
    const number = Number(value);
    if (!Number.isFinite(number) || (schema.type === "integer" && !Number.isSafeInteger(number))) return false;
    if (schema.minimum !== undefined && number < schema.minimum) return false;
    if (schema.maximum !== undefined && number > schema.maximum) return false;
  }
  return true;
}

/** Public catalogue reads only; the upstream host and credentials are owned by Whatsarr. */
@Injectable()
export class AgentTmdbService {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  async query(value: unknown) {
    const input = record(value);
    if (!input || Object.keys(input).length > 80 || Object.values(input).some((v) => typeof v !== "string" || v.length > 2048)) invalid();
    const query = input as Record<string, string>;
    if (JSON.stringify(query).length > 8000 || !query.path) invalid();
    const route = matchTmdbRoute(query.path);
    if (!route) invalid();
    const parameters = route.parameters.filter((p) => p.in === "query");
    for (const [key, value] of Object.entries(query)) {
      if (key === "path") continue;
      const parameter = parameters.find((p) => p.name === key);
      if (!parameter || !validValue(value, parameter.schema)) invalid();
    }
    if (parameters.some((p) => p.required && !query[p.name]?.trim())) invalid();
    if (query.page !== undefined && (!/^[1-9]\d*$/.test(query.page) || Number(query.page) > 500)) invalid();
    if (query.append_to_response !== undefined) {
      const appended = query.append_to_response.split(",");
      if (appended.length > 10 || appended.some((part) => !matchTmdbRoute(`${query.path}/${part}`))) invalid();
    }

    const config = await this.settings.getDecryptedService("tmdb");
    const key = config?.apiKey?.trim();
    if (!key) throw new AgentError(409, "TMDB_NOT_CONFIGURED", "Configurez la clé TMDB dans Paramètres.");
    const url = new URL(`https://api.themoviedb.org/3/${query.path}`);
    for (const [name, value] of Object.entries(query)) if (name !== "path") url.searchParams.set(name, value);
    if (!url.searchParams.has("language") && parameters.some((p) => p.name === "language")) url.searchParams.set("language", "fr-FR");
    const headers: Record<string, string> = {};
    if (/^[a-f\d]{32}$/i.test(key)) url.searchParams.set("api_key", key);
    else headers.Authorization = /^Bearer /i.test(key) ? key : `Bearer ${key}`;

    const session = new AgentSourceSession("TMDB");
    try {
      const data = await session.json(url, headers);
      if ((!record(data) && !Array.isArray(data)) || record(data)?.success === false) session.error("UNREACHABLE");
      return { source: "tmdb", path: query.path, data, attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB." };
    } finally {
      session.close();
    }
  }
}

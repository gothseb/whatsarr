import { Injectable } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { MediaServiceKey, SERVICE_LABELS, isMediaService } from "./settings.constants";

type ConnectionStatus =
  | "connected"
  | "authentication_error"
  | "unreachable"
  | "not_configured";

@Injectable()
export class ConnectionTestService {
  constructor(private readonly settings: SettingsService) {}

  async test(serviceKey: string) {
    if (!isMediaService(serviceKey)) {
      return {
        serviceKey,
        status: "not_configured" as ConnectionStatus,
        message: "Service media inconnu."
      };
    }

    const config = await this.settings.getDecryptedService(serviceKey);
    if (!config?.apiKey || (serviceKey !== "tmdb" && !config.baseUrl)) {
      return {
        serviceKey,
        status: "not_configured" as ConnectionStatus,
        message: `${SERVICE_LABELS[serviceKey]} n'est pas encore configure.`
      };
    }

    try {
      const response = await this.callService(serviceKey, config.baseUrl, config.apiKey);
      if (response.ok) {
        return {
          serviceKey,
          status: "connected" as ConnectionStatus,
          message: `${SERVICE_LABELS[serviceKey]} est joignable.`
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          serviceKey,
          status: "authentication_error" as ConnectionStatus,
          message: "Authentification refusee. Verifiez la cle API."
        };
      }

      return {
        serviceKey,
        status: "unreachable" as ConnectionStatus,
        message: `Le service repond avec le statut HTTP ${response.status}.`
      };
    } catch {
      return {
        serviceKey,
        status: "unreachable" as ConnectionStatus,
        message: "Service inaccessible. Verifiez l'URL, le reseau ou le conteneur cible."
      };
    }
  }

  private callService(serviceKey: MediaServiceKey, baseUrl: string | null, apiKey: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const request = buildRequest(serviceKey, baseUrl, apiKey);
    return fetch(request.url, {
      method: "GET",
      headers: request.headers,
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
  }
}

function buildRequest(
  serviceKey: MediaServiceKey,
  baseUrl: string | null,
  apiKey: string
): { url: string; headers: Record<string, string> } {
  switch (serviceKey) {
    case "plex":
      return {
        url: `${baseUrl}/identity?X-Plex-Token=${encodeURIComponent(apiKey)}`,
        headers: {}
      };
    case "tautulli":
      return {
        url: `${baseUrl}/api/v2?cmd=get_server_info&apikey=${encodeURIComponent(apiKey)}`,
        headers: {}
      };
    case "overseerr":
      return {
        url: `${baseUrl}/api/v1/status`,
        headers: { "X-Api-Key": apiKey }
      };
    case "radarr":
    case "sonarr":
      return {
        url: `${baseUrl}/api/v3/system/status`,
        headers: { "X-Api-Key": apiKey }
      };
    case "tmdb":
      return {
        url: `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(apiKey)}`,
        headers: {}
      };
  }
}

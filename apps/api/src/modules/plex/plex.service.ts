import { BadRequestException, Injectable } from "@nestjs/common";
import { SettingsService } from "../settings/settings.service";

export interface ImportedPlexUser {
  plexUserId: string;
  username: string | null;
  displayName: string;
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string | null;
}

@Injectable()
export class PlexService {
  constructor(private readonly settings: SettingsService) {}

  async fetchUsers(): Promise<ImportedPlexUser[]> {
    const settings = await this.settings.getDecryptedService("plex");

    if (!settings?.baseUrl || !settings.apiKey) {
      throw new BadRequestException("Plex n'est pas configure.");
    }

    const url = new URL("/accounts", settings.baseUrl);
    url.searchParams.set("X-Plex-Token", settings.apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" }
      });
    } catch {
      throw new BadRequestException("Plex est inaccessible.");
    }

    if (!response.ok) {
      throw new BadRequestException("Plex a refuse l'import des utilisateurs.");
    }

    const body = await response.text();
    return this.parseUsers(body);
  }

  async fetchLibraries(): Promise<PlexLibrary[]> {
    const settings = await this.settings.getDecryptedService("plex");

    if (!settings?.baseUrl || !settings.apiKey) {
      throw new BadRequestException("Plex n'est pas configure.");
    }

    const url = new URL("/library/sections", settings.baseUrl);
    url.searchParams.set("X-Plex-Token", settings.apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" }
      });
    } catch {
      throw new BadRequestException("Plex est inaccessible.");
    }

    if (!response.ok) {
      throw new BadRequestException("Plex a refuse la liste des bibliotheques.");
    }

    const body = await response.text();
    return this.parseLibraries(body);
  }

  private parseUsers(body: string): ImportedPlexUser[] {
    const parsed = tryParseJson(body);
    if (parsed) {
      return normalizeUsers(readJsonUsers(parsed));
    }

    return normalizeUsers(readXmlUsers(body));
  }

  private parseLibraries(body: string): PlexLibrary[] {
    const parsed = tryParseJson(body);
    if (parsed) {
      return normalizeLibraries(readJsonLibraries(parsed));
    }

    return normalizeLibraries(readXmlLibraries(body));
  }
}

function tryParseJson(body: string): unknown | null {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function readJsonUsers(body: unknown): ImportedPlexUser[] {
  const container = readRecord(body);
  const mediaContainer = readRecord(container.MediaContainer);
  const users = readArray(mediaContainer.User ?? container.User);
  return users
    .map((item) => {
      const user = readRecord(item);
      return {
        plexUserId: String(user.id ?? user.uuid ?? ""),
        username: readOptionalString(user.username),
        displayName: readRequiredString(user.title ?? user.username ?? user.email)
      };
    })
    .filter((user) => user.plexUserId && user.displayName);
}

function readJsonLibraries(body: unknown): PlexLibrary[] {
  const container = readRecord(body);
  const mediaContainer = readRecord(container.MediaContainer);
  const directories = readArray(mediaContainer.Directory ?? container.Directory);
  return directories
    .map((item) => {
      const directory = readRecord(item);
      return {
        key: String(directory.key ?? ""),
        title: readRequiredString(directory.title),
        type: readOptionalString(directory.type)
      };
    })
    .filter((library) => library.key && library.title);
}

function readXmlUsers(body: string): ImportedPlexUser[] {
  const users: ImportedPlexUser[] = [];
  const userTags = body.matchAll(/<User\s+([^>]+?)\/?>/g);

  for (const match of userTags) {
    const attributes = readXmlAttributes(match[1]);
    const plexUserId = attributes.id ?? attributes.uuid ?? "";
    const displayName = attributes.title ?? attributes.username ?? attributes.email ?? "";
    if (plexUserId && displayName) {
      users.push({
        plexUserId,
        username: attributes.username ?? null,
        displayName
      });
    }
  }

  return users;
}

function readXmlLibraries(body: string): PlexLibrary[] {
  const libraries: PlexLibrary[] = [];
  const directoryTags = body.matchAll(/<Directory\s+([^>]+?)\/?>/g);

  for (const match of directoryTags) {
    const attributes = readXmlAttributes(match[1]);
    const key = attributes.key ?? "";
    const title = attributes.title ?? "";
    if (key && title) {
      libraries.push({
        key,
        title,
        type: attributes.type ?? null
      });
    }
  }

  return libraries;
}

function normalizeUsers(users: ImportedPlexUser[]) {
  const byId = new Map<string, ImportedPlexUser>();
  for (const user of users) {
    if (!byId.has(user.plexUserId)) {
      byId.set(user.plexUserId, user);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

function normalizeLibraries(libraries: PlexLibrary[]) {
  const byKey = new Map<string, PlexLibrary>();
  for (const library of libraries) {
    if (!byKey.has(library.key)) {
      byKey.set(library.key, library);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function readXmlAttributes(input: string) {
  const attributes: Record<string, string> = {};
  for (const match of input.matchAll(/([A-Za-z0-9_:-]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRequiredString(value: unknown) {
  return typeof value === "string" ? value : "";
}

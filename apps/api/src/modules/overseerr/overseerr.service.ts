import { BadRequestException, Injectable } from "@nestjs/common";
import { SettingsService } from "../settings/settings.service";
import type { ImportedPlexUser } from "../plex/plex.service";

const PAGE_SIZE = 100;

@Injectable()
export class OverseerrService {
  constructor(private readonly settings: SettingsService) {}

  async fetchUsers(): Promise<ImportedPlexUser[]> {
    const settings = await this.settings.getDecryptedService("overseerr");

    if (!settings?.baseUrl || !settings.apiKey) {
      throw new BadRequestException("Overseerr n'est pas configure.");
    }

    const users: ImportedPlexUser[] = [];
    let skip = 0;

    while (true) {
      const url = new URL("/api/v1/user", settings.baseUrl);
      url.searchParams.set("take", String(PAGE_SIZE));
      url.searchParams.set("skip", String(skip));

      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "X-Api-Key": settings.apiKey
          }
        });
      } catch {
        throw new BadRequestException("Overseerr est inaccessible.");
      }

      if (!response.ok) {
        throw new BadRequestException(
          "Overseerr a refuse l'import des utilisateurs."
        );
      }

      const body = (await response.json()) as unknown;
      const page = readUsersPage(body, skip);
      users.push(...page.users);

      if (!page.hasMore) {
        break;
      }

      skip += PAGE_SIZE;
    }

    return normalizeUsers(users);
  }
}

function readUsersPage(body: unknown, skip: number) {
  const container = readRecord(body);
  const results = readArray(container.results ?? container.users ?? container.data);
  const users = results.map(normalizeOverseerrUser).filter(isImportedPlexUser);
  const pageInfo = readRecord(container.pageInfo);
  const total =
    readNumber(pageInfo.results) ??
    readNumber(container.totalResults) ??
    readNumber(container.total);
  const hasMore = total !== null ? skip + users.length < total : users.length === PAGE_SIZE;

  return { users, hasMore };
}

function normalizeOverseerrUser(item: unknown): ImportedPlexUser | null {
  const user = readRecord(item);
  const overseerrId = readString(user.id);
  const plexUserId = readString(user.plexId) ?? (overseerrId ? `overseerr:${overseerrId}` : null);
  const username =
    readString(user.plexUsername) ??
    readString(user.username) ??
    readString(user.email);
  const displayName =
    readString(user.displayName) ??
    readString(user.plexUsername) ??
    readString(user.username) ??
    readString(user.email);

  if (!plexUserId || !displayName) {
    return null;
  }

  return {
    plexUserId,
    username,
    displayName
  };
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

function isImportedPlexUser(user: ImportedPlexUser | null): user is ImportedPlexUser {
  return user !== null;
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

function readString(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

import { BadRequestException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverseerrService } from "./overseerr.service";

describe("OverseerrService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("imports users from the Overseerr users API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          pageInfo: { results: 1 },
          results: [
            {
              id: 42,
              email: "alice@example.test",
              plexUsername: "alice",
              displayName: "Alice"
            }
          ]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new OverseerrService(createSettings() as never);

    await expect(service.fetchUsers()).resolves.toEqual([
      {
        plexUserId: "overseerr:42",
        username: "alice",
        displayName: "Alice"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://overseerr.test/api/v1/user?take=100&skip=0"),
      {
        headers: {
          Accept: "application/json",
          "X-Api-Key": "overseerr-key"
        }
      }
    );
  });

  it("keeps Plex ids when Overseerr exposes one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            pageInfo: { results: 1 },
            results: [{ id: 42, plexId: "plex-42", plexUsername: "alice" }]
          }),
          { status: 200 }
        )
      )
    );
    const service = new OverseerrService(createSettings() as never);

    await expect(service.fetchUsers()).resolves.toMatchObject([
      {
        plexUserId: "plex-42",
        username: "alice",
        displayName: "alice"
      }
    ]);
  });

  it("rejects unconfigured Overseerr settings", async () => {
    const service = new OverseerrService(createSettings(null) as never);

    await expect(service.fetchUsers()).rejects.toThrow(BadRequestException);
  });
});

function createSettings(
  config: { baseUrl: string; apiKey: string } | null = {
    baseUrl: "http://overseerr.test",
    apiKey: "overseerr-key"
  }
) {
  return {
    getDecryptedService: vi.fn(async () =>
      config
        ? {
            serviceKey: "overseerr",
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            username: null,
            password: null
          }
        : null
    )
  };
}

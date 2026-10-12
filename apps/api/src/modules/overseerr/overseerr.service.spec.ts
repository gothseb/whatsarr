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
        signal: expect.any(AbortSignal),
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

  it("uses the unfiltered page size to find the next page", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: Array.from({ length: 100 }, (_, id) => ({ id }))
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ id: 101, plexUsername: "alice" }]
      })));
    vi.stubGlobal("fetch", fetchMock);

    const users = await new OverseerrService(createSettings() as never).fetchUsers();

    expect(users).toMatchObject([{ plexUserId: "overseerr:101" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0].searchParams.get("skip")).toBe("100");
  });

  it("stops on an empty page even if the API reports more results", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      pageInfo: { results: 100 }, results: []
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new OverseerrService(createSettings() as never).fetchUsers()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
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

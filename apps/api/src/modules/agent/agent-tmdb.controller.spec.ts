import "reflect-metadata";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AgentTmdbController } from "./agent-tmdb.controller";
import { AgentTmdbService, matchTmdbRoute } from "./agent-tmdb.service";
import { SettingsService } from "../settings/settings.service";
import { configureAgentHttp } from "./agent-exception.filter";
import { tmdbCatalogue } from "./tmdb-catalogue";

describe("Hermes TMDB catalogue HTTP", () => {
  let app: INestApplication, base: string;
  const client = globalThis.fetch;
  const upstream = vi.fn();
  const key = "a".repeat(32);
  const settings = { getDecryptedService: vi.fn() };
  const get = (query: string) => client(`${base}/api/agent/tmdb${query}`);
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AgentTmdbController], providers: [AgentTmdbService, { provide: SettingsService, useValue: settings }] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    configureAgentHttp(app);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    settings.getDecryptedService.mockReset().mockResolvedValue({ apiKey: key, baseUrl: "http://untrusted.local" });
    upstream.mockReset().mockImplementation(async () => new Response(JSON.stringify({ page: 1, results: [{ id: 550, title: "Fight Club" }], total_pages: 2 })));
    vi.stubGlobal("fetch", upstream);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("searches using the stored key and French by default, without WhatsApp or cookie", async () => {
    const response = await get("?path=search/movie&query=Fight%20Club&page=2");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "tmdb", path: "search/movie", data: { results: [{ id: 550 }] } });
    const [url, options] = upstream.mock.calls[0];
    expect(url.origin).toBe("https://api.themoviedb.org");
    expect(url.pathname).toBe("/3/search/movie");
    expect(url.searchParams.get("api_key")).toBe(key);
    expect(url.searchParams.get("language")).toBe("fr-FR");
    expect(url.searchParams.get("page")).toBe("2");
    expect(options.redirect).toBe("error");
    expect(settings.getDecryptedService).toHaveBeenCalledWith("tmdb");
  });
  it.each([
    "?path=movie/550/recommendations", "?path=tv/1399/similar", "?path=trending/movie/week",
    "?path=trending/tv/day", "?path=discover/movie&with_genres=878&vote_average.gte=7&sort_by=vote_average.desc",
    "?path=tv/1399/season/0/episode/1&append_to_response=credits,images", "?path=movie/550&append_to_response=credits,videos,watch/providers",
    "?path=movie/550/watch/providers", "?path=configuration", "?path=person/287/combined_credits", "?path=find/tt0137523&external_source=imdb_id"
  ])("reads catalogue feature %s", async (query) => { expect((await get(query)).status).toBe(200); });

  it("supports a read access Bearer token and preserves public data and explicit language", async () => {
    settings.getDecryptedService.mockResolvedValue({ apiKey: "Bearer read-access-token" });
    upstream.mockResolvedValue(new Response(JSON.stringify([{ iso_639_1: "fr" }])));
    const response = await get("?path=configuration/languages");
    expect(await response.json()).toMatchObject({ data: [{ iso_639_1: "fr" }] });
    expect(upstream.mock.calls[0][0].searchParams.has("api_key")).toBe(false);
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe("Bearer read-access-token");
  });

  it.each([
    "", "?path=", "?path=https://evil.test", "?path=//evil.test", "?path=movie/../configuration", "?path=movie%2F550%3Fapi_key%3Dstolen",
    "?path=search/movie", "?path=search/movie&query=%20", "?path=search/movie&query=a&query=b", "?path=search/movie&query[]=a",
    "?path=movie/-1", "?path=movie/1.5", "?path=movie/9007199254740992", "?path=trending/movie/year",
    "?path=search/movie&query=x&api_key=evil", "?path=movie/550&session_id=secret", "?path=authentication/token/new", "?path=account/1", "?path=guest_session/abc/rated/movies",
    "?path=movie/550/account_states", "?path=movie/550&append_to_response=account_states", "?path=movie/550&append_to_response=credits,,images",
    "?path=movie/popular&page=0", "?path=movie/popular&page=501", "?path=movie/popular&page=Infinity", "?path=search/movie&query=x&include_adult=yes",
    "?path=movie/popular&unknown=x", "?path=configuration&path=movie/latest"
    , "?path=search/movie&query=" + "x".repeat(2049)
  ])("rejects invalid or non-catalogue requests before credentials or upstream: %s", async (query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "AGENT_INVALID_REQUEST", requestId: expect.any(String) } });
    expect(settings.getDecryptedService).not.toHaveBeenCalled();
    expect(upstream).not.toHaveBeenCalled();
  });

  it("publishes a discoverable catalogue even when TMDB is not configured", async () => {
    settings.getDecryptedService.mockResolvedValue(null);
    const response = await get("/catalogue");
    expect(response.status).toBe(200);
    const body = await response.json() as { routes: { path: string }[] };
    expect(body.routes).toHaveLength(116);
    expect(body.routes).toContainEqual(expect.objectContaining({ path: "movie/{movie_id}/recommendations" }));
    expect(settings.getDecryptedService).not.toHaveBeenCalled();
  });
  it("accepts a concrete public example for every published route", () => {
    for (const route of tmdbCatalogue) {
      const path = route.path.replace(/\{([^}]+)\}/g, (_, name: string) => name === "time_window" ? "day" : "1");
      expect(matchTmdbRoute(path)?.path).toBe(route.path);
    }
  });
  it("returns a clear setup error", async () => {
    settings.getDecryptedService.mockResolvedValue(null);
    const response = await get("?path=movie/popular");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "TMDB_NOT_CONFIGURED" } });
    expect(upstream).not.toHaveBeenCalled();
  });
  it.each([[401, 502, "TMDB_AUTHENTICATION_ERROR"], [403, 502, "TMDB_AUTHENTICATION_ERROR"], [404, 404, "TMDB_NOT_FOUND"], [429, 429, "TMDB_RATE_LIMITED"], [400, 400, "TMDB_BAD_REQUEST"], [500, 502, "TMDB_UNREACHABLE"]])("maps upstream %i without exposing secrets", async (status, expected, code) => {
    upstream.mockResolvedValue(new Response(`secret ${key}`, { status: status as number }));
    const response = await get("?path=movie/550");
    expect(response.status).toBe(expected);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code } });
    expect(JSON.stringify(body)).not.toContain(key);
  });
  it.each(["not-json", "null", '{"success":false}', "1"])("rejects an unusable successful response %s", async (body) => {
    upstream.mockResolvedValue(new Response(body));
    const response = await get("?path=movie/550");
    expect(response.status).toBe(502);
  });
  it("bounds response size", async () => {
    upstream.mockResolvedValue(new Response("{}", { headers: { "content-length": String(4 * 1024 * 1024 + 1) } }));
    expect((await get("?path=movie/550")).status).toBe(502);
  });
  it("bounds streamed bodies even without content-length", async () => {
    upstream.mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1)); controller.close(); } })));
    expect((await get("?path=movie/550")).status).toBe(502);
  });
  it("does not expose write methods", async () => {
    const response = await client(`${base}/api/agent/tmdb?path=movie/550/rating`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"value":10}' });
    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("maps timeouts without leaking URLs", async () => {
    upstream.mockImplementation((_url, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("secret")))));
    const service = new AgentTmdbService(settings as never);
    vi.useFakeTimers();
    try {
      const pending = expect(service.query({ path: "movie/550" })).rejects.toMatchObject({ code: "TMDB_TIMEOUT" });
      await vi.advanceTimersByTimeAsync(15_001);
      await pending;
    } finally { vi.useRealTimers(); }
  });
});

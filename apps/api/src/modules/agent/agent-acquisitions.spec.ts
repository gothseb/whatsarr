import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { AgentArrService } from "./agent-arr.service";
import { AgentAvailabilityService } from "./agent-availability.service";
import { AgentRequestsService } from "./agent-requests.service";
import { addInput, arrQuery } from "./agent-arr.dto";
import { AgentError } from "./agent.types";
const settings = { getDecryptedService: vi.fn(async () => ({ baseUrl: "http://source.test/base", apiKey: "SECRET" })) };
const logs = { log: vi.fn(async () => { }) };
let fetcher: ReturnType<typeof vi.fn>;
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const movie = { id: 8, tmdbId: 550, title: "Fight Club", year: 1999, titleSlug: "fight-club", tags: [2], monitored: true, hasFile: false };
const opts = { externalId: 550, qualityProfileId: 1, rootFolderId: 1, tagIds: [2], monitored: true, search: false };
function arrRoutes(existing: unknown[] = [], post?: () => Response | Promise<Response>) { fetcher.mockImplementation(async (url: URL, init: RequestInit) => { const p = url.pathname; if (init.method === "POST")
    return post ? post() : response(movie, 201); if (p.endsWith("/qualityprofile"))
    return response([{ id: 1, name: "HD" }]); if (p.endsWith("/rootfolder"))
    return response([{ id: 1, path: "/media", accessible: true }]); if (p.endsWith("/tag"))
    return response([{ id: 2, label: "family" }]); if (p.endsWith("/lookup"))
    return response([{ ...movie, path: "/evil", seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }], tvdbId: 42 }]); return response(existing); }); }
beforeEach(() => { vi.clearAllMocks(); fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); settings.getDecryptedService.mockResolvedValue({ baseUrl: "http://source.test/base", apiKey: "SECRET" }); });
afterEach(() => vi.unstubAllGlobals());
describe("Arr read and acquisitions", () => {
    it("normalizes and filters tags before pagination without exposing source secrets", async () => { arrRoutes([movie, { ...movie, id: 9, title: "Other", tags: [] }]); const s = new AgentArrService(settings as never, logs as never); const r = await s.list("radarr", arrQuery({ tagId: "2", limit: "1" })); expect(r.items).toHaveLength(1); expect(r.items[0].tags).toEqual([{ id: 2, label: "family" }]); expect(JSON.stringify(r)).not.toMatch(/SECRET|evil/); });
    it("adds once using selected root and safe lookup metadata", async () => { arrRoutes(); const r = await new AgentArrService(settings as never, logs as never).add("radarr", opts, "req"); expect(r.deduplicated).toBe(false); const [, init] = fetcher.mock.calls.find(([, i]) => i.method === "POST")!; const body = JSON.parse(init.body); expect(body).toMatchObject({ tmdbId: 550, rootFolderPath: "/media", monitored: true, addOptions: { searchForMovie: false } }); expect(body.path).toBeUndefined(); expect(body.id).toBeUndefined(); expect(logs.log).toHaveBeenCalledWith(expect.objectContaining({ requestId: "req" })); });
    it("returns existing without changing its tags or options", async () => { arrRoutes([movie]); const r = await new AgentArrService(settings as never, logs as never).add("radarr", { ...opts, qualityProfileId: 999 }, "req"); expect(r.deduplicated).toBe(true); expect(fetcher.mock.calls.some(([, i]) => i.method === "POST")).toBe(false); });
    it.each([{ qualityProfileId: 8 }, { rootFolderId: 8 }, { tagIds: [9] }])("rejects unknown options %j before POST", async (change) => { arrRoutes(); await expect(new AgentArrService(settings as never, logs as never).add("radarr", { ...opts, ...change }, "req")).rejects.toMatchObject({ code: "ARR_INVALID_OPTIONS" }); expect(fetcher.mock.calls.some(([, i]) => i.method === "POST")).toBe(false); });
    it("never repeats a POST after lost response, and reports unknown outcome", async () => { arrRoutes([], async () => { throw Error("SECRET network"); }); await expect(new AgentArrService(settings as never, logs as never).add("radarr", opts, "req")).rejects.toMatchObject({ code: "ARR_ADD_UNCERTAIN" }); expect(fetcher.mock.calls.filter(([, i]) => i.method === "POST")).toHaveLength(1); });
    it("reconciles a lost POST response against existing exact ID", async () => { const existing: unknown[] = []; arrRoutes(existing, async () => { existing.push(movie); throw Error(); }); const r = await new AgentArrService(settings as never, logs as never).add("radarr", opts, "req"); expect(r).toMatchObject({ deduplicated: true, reconciled: true }); expect(fetcher.mock.calls.filter(([, i]) => i.method === "POST")).toHaveLength(1); });
    it("serializes concurrent additions and preserves existing result", async () => { const existing: unknown[] = []; arrRoutes(existing, async () => { await new Promise(resolve => setTimeout(resolve, 10)); existing.push(movie); return response(movie, 201); }); const s = new AgentArrService(settings as never, logs as never), results = await Promise.all([s.add("radarr", opts, "a"), s.add("radarr", opts, "b")]); expect(results.map(r => r.deduplicated)).toEqual([false, true]); expect(fetcher.mock.calls.filter(([, i]) => i.method === "POST")).toHaveLength(1); });
    it("does not turn log failures into duplicate additions", async () => { arrRoutes(); logs.log.mockRejectedValueOnce(Error()); await expect(new AgentArrService(settings as never, logs as never).add("radarr", opts, "req")).resolves.toMatchObject({ deduplicated: false }); expect(fetcher.mock.calls.filter(([, i]) => i.method === "POST")).toHaveLength(1); });
    it.each([400, 401, 403, 404, 429])("preserves known rejection %i", async (status) => { arrRoutes([], () => response({ secret: "SECRET" }, status)); await expect(new AgentArrService(settings as never, logs as never).add("radarr", opts, "req")).rejects.toMatchObject({ status: [401, 403].includes(status) ? 502 : status }); expect(fetcher.mock.calls.filter(([, i]) => i.method === "POST")).toHaveLength(1); });
    it("series seasons exclude specials by default and search remains opt in", async () => { arrRoutes([], () => response({ ...movie, tvdbId: 42 }, 201)); await new AgentArrService(settings as never, logs as never).add("sonarr", { ...opts, externalId: 42 }, "req"); const body = JSON.parse(fetcher.mock.calls.find(([, i]) => i.method === "POST")![1].body); expect(body.seasons).toEqual([{ seasonNumber: 0, monitored: false }, { seasonNumber: 1, monitored: true }]); expect(body.addOptions.searchForMissingEpisodes).toBe(false);
        expect(body.addOptions.monitor).toBe("skip"); });
    it("validates explicitly requested seasons before adding", async () => { arrRoutes(); await expect(new AgentArrService(settings as never, logs as never).add("sonarr", { ...opts, externalId: 42, seasonNumbers: [99] }, "req")).rejects.toMatchObject({ code: "ARR_INVALID_SEASONS" }); });
    it("reports missing config without a source request", async () => { settings.getDecryptedService.mockResolvedValue(null as never); await expect(new AgentArrService(settings as never, logs as never).tags("sonarr")).rejects.toMatchObject({ code: "SONARR_NOT_CONFIGURED" }); expect(fetcher).not.toHaveBeenCalled(); });
});
describe("POST uncertainty deadline",()=>{
 it("times out once and reconciles without another POST",async()=>{
  vi.useFakeTimers();
  try {
   arrRoutes([],()=>new Promise((_resolve,reject)=>{const init=fetcher.mock.calls.at(-1)![1];init.signal.addEventListener("abort",()=>reject(new Error("aborted")));}));
   const outcome=new AgentArrService(settings as never,logs as never).add("radarr",opts,"deadline").catch(error=>error);
   await vi.advanceTimersByTimeAsync(15001);
   expect(await outcome).toMatchObject({code:"ARR_ADD_UNCERTAIN"});
   expect(fetcher.mock.calls.filter(([,i])=>i.method==="POST")).toHaveLength(1);
  } finally {vi.useRealTimers();}
 });
 it("reconciles an upstream duplicate conflict from another process",async()=>{
  const existing:unknown[]=[];arrRoutes(existing,()=>{existing.push(movie);return response({},409);});
  const result=await new AgentArrService(settings as never,logs as never).add("radarr",opts,"concurrent");
  expect(result).toMatchObject({deduplicated:true,reconciled:true});
  expect(fetcher.mock.calls.filter(([,i])=>i.method==="POST")).toHaveLength(1);
 });
});

describe("input boundaries", () => {
    it("defaults monitored true and immediate search false", () => expect(addInput({ tmdbId: 550, qualityProfileId: 1, rootFolderId: 1 }, "radarr")).toMatchObject({ monitored: true, search: false, tagIds: [] }));
    it.each([{ tmdbId: "550" }, { tmdbId: 0 }, { tmdbId: 550, path: "/evil" }, { tmdbId: 550, search: "true" }, { tmdbId: 550, tagIds: [2, 2] }, { tmdbId: 550, tagIds: [-1] }])("rejects invalid body %j", body => expect(() => addInput({ qualityProfileId: 1, rootFolderId: 1, ...body }, "radarr")).toThrow());
    it.each([{ limit: "101" }, { tagId: "0" }, { monitored: "yes" }, { q: ["x"] }, { extra: "x" }])("rejects invalid query %j", q => expect(() => arrQuery(q)).toThrow());
});
describe("availability", () => {
    it("keeps tracked, files and Plex presence distinct including partial series", async () => { const arr = { presence: vi.fn(async () => ({ state: "known", tracked: true, item: { episodeFileCount: 3, episodeCount: 10 } })) }, plex = { availability: vi.fn(async () => ({ state: "known", present: true, items: [{ episodeCount: 3 }] })) }, agent = { recapLibraries: vi.fn(async () => new Set(["1"])) }; const r = await new AgentAvailabilityService(arr as never, agent as never, plex as never).check("series", 42); expect(r.arr).toMatchObject({ item: { episodeFileCount: 3, episodeCount: 10 } }); expect(r.plex).toMatchObject({ present: true }); expect(JSON.stringify(r)).not.toContain('"complete":true'); });
    it("never equates upstream failure with absent", async () => { const arr = { presence: vi.fn(async () => { throw new AgentError(504, "SONARR_TIMEOUT", "secret"); }) }, plex = { availability: vi.fn(async () => ({ state: "known", present: false, items: [] })) }, agent = { recapLibraries: vi.fn(async () => new Set()) }; const r = await new AgentAvailabilityService(arr as never, agent as never, plex as never).check("series", 42); expect(r.arr).toEqual({ state: "unknown", error: { code: "SONARR_TIMEOUT" } }); });
});
describe("Seerr", () => {
    it("filters requesters and normalizes data without email or keys", async () => { fetcher.mockImplementation(async (url: URL) => url.pathname.endsWith("/request") ? response({ pageInfo: { results: 2 }, results: [{ id: 1, type: "movie", status: 2, requestedBy: { id: 7, username: "Seb", email: "private" }, media: { tmdbId: 550, status: 3 } }, { id: 2, type: "movie", requestedBy: { id: 8 }, media: { tmdbId: 551 } }] }) : response({ title: "Fight Club" })); const r = await new AgentRequestsService(settings as never).list({ requestedBy: "7" }); expect(r.items).toHaveLength(1); expect(r.items[0]).toMatchObject({ title: "Fight Club", requestedBy: { id: 7, name: "Seb" }, requestStatus: 2, mediaStatus: 3 }); expect(JSON.stringify(r)).not.toMatch(/email|private|SECRET/); });
});

describe("Review regressions: trustworthy upstream state",()=>{
 it.each([{}, {id:1,title:"Film"}, {id:0,title:"Film",tmdbId:550}, {id:1,title:"",tmdbId:550}, {id:1,title:"Film",tmdbId:{secret:"SECRET"}}])("rejects malformed tracked rows %j before absence or POST",async bad=>{
  arrRoutes([bad]);const s=new AgentArrService(settings as never,logs as never);
  await expect(s.presence("radarr",550)).rejects.toMatchObject({code:"ARR_INVALID_RESPONSE"});
  await expect(s.add("radarr",opts,"bad-upstream")).rejects.toMatchObject({code:"ARR_INVALID_RESPONSE"});
  expect(fetcher.mock.calls.filter(([,i])=>i.method==="POST")).toHaveLength(0);
 });
 it("turns malformed Arr catalogue into unknown availability",async()=>{
  arrRoutes([{}]);const s=new AgentArrService(settings as never,logs as never);
  const result=await new AgentAvailabilityService(s,{recapLibraries:async()=>new Set()} as never,{availability:async()=>({state:"known",present:false,items:[]})} as never).check("movie",550);
  expect(result.arr).toEqual({state:"unknown",error:{code:"ARR_INVALID_RESPONSE"}});
 });
 it("rejects object tag IDs rather than exposing upstream objects",async()=>{
  arrRoutes([{...movie,tags:[{secret:"SECRET"}]}]);
  await expect(new AgentArrService(settings as never,logs as never).list("radarr",arrQuery({}))).rejects.toMatchObject({code:"ARR_INVALID_RESPONSE"});
 });
 it("rejects malformed profile IDs rather than passing upstream objects",async()=>{
  fetcher.mockResolvedValue(response([{id:{secret:"SECRET"},name:"HD"}]));
  await expect(new AgentArrService(settings as never,logs as never).options("radarr")).rejects.toMatchObject({code:"ARR_INVALID_RESPONSE"});
 });
 it("runs its own valid input after a concurrent known invalid predecessor",async()=>{
  arrRoutes();const s=new AgentArrService(settings as never,logs as never);
  const bad=s.add("radarr",{...opts,qualityProfileId:999},"invalid").catch(e=>e);
  const good=s.add("radarr",opts,"valid");
  expect(await bad).toMatchObject({code:"ARR_INVALID_OPTIONS"});
  expect(await good).toMatchObject({deduplicated:false});
  expect(fetcher.mock.calls.filter(([,i])=>i.method==="POST")).toHaveLength(1);
 });
 it("does not repeat a concurrent predecessor with uncertain POST outcome",async()=>{
  arrRoutes([],()=>{throw Error("response lost");});const s=new AgentArrService(settings as never,logs as never);
  const results=await Promise.allSettled([s.add("radarr",opts,"first"),s.add("radarr",opts,"second")]);
  expect(results).toHaveLength(2);for(const result of results){expect(result.status).toBe("rejected");if(result.status==="rejected")expect(result.reason).toMatchObject({code:"ARR_ADD_UNCERTAIN"});}
  expect(fetcher.mock.calls.filter(([,i])=>i.method==="POST")).toHaveLength(1);
 });
 it.each([{status4k:3,expected:3},{expected:null}])("uses 4K status exclusively for a 4K request %j",async row=>{
  fetcher.mockImplementation(async(url:URL)=>url.pathname.endsWith("/request/42")?response({id:42,type:"movie",is4k:true,media:{tmdbId:550,status:5,...row},requestedBy:{id:7}}):response({title:"Film"}));
  const r=await new AgentRequestsService(settings as never).detail(42);expect(r.item).toMatchObject({is4k:true,mediaStatus:row.expected});
 });
});

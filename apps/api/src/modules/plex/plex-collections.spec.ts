import { afterEach, describe, it, expect, vi } from "vitest";
import { plexCollectionRead, plexExactAvailability } from "./plex-collections";
const config = { baseUrl: "http://plex.test", apiKey: "SECRET" };
const response = (body: unknown) => new Response(JSON.stringify({ MediaContainer: body }));
afterEach(() => vi.unstubAllGlobals());
describe("Plex collections boundary", () => {
    it("returns empty without upstream reads when no recap selected", async () => { const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); expect(await plexCollectionRead(config, new Set(), { offset: 0, limit: 20 })).toMatchObject({ items: [] }); expect(fetch).not.toHaveBeenCalled(); });
    it("never reads excluded collection children", async () => { const fetch = vi.fn(async (url: URL) => response(url.pathname === "/library/sections" ? { Directory: [{ key: "1", type: "movie" }, { key: "9", type: "movie" }] } : { Metadata: [{ ratingKey: "10", title: "Allowed" }], size: 1, totalSize: 1 })); vi.stubGlobal("fetch", fetch); await expect(plexCollectionRead(config, new Set(["1"]), { offset: 0, limit: 20 }, "99")).rejects.toMatchObject({ code: "PLEX_COLLECTION_NOT_FOUND" }); expect(fetch.mock.calls.map(c => String(c[0])).join(" ")).not.toMatch(/sections\/9|collections\/99/); });
    it("checks each child belongs to the allowed library", async () => { vi.stubGlobal("fetch", vi.fn(async (url: URL) => response(url.pathname === "/library/sections" ? { Directory: [{ key: "1", type: "movie" }] } : url.pathname.endsWith("/children") ? { Metadata: [{ ratingKey: "3", title: "Hidden", type: "movie", librarySectionID: "9" }], size: 1, totalSize: 1 } : { Metadata: [{ ratingKey: "10", title: "Allowed" }], size: 1, totalSize: 1 }))); await expect(plexCollectionRead(config, new Set(["1"]), { offset: 0, limit: 20 }, "10")).rejects.toMatchObject({ code: "PLEX_UNREACHABLE" }); });
    it("accepts library ID hoisted to the authorized container",async()=>{
        vi.stubGlobal("fetch",vi.fn(async(url:URL)=>response(url.pathname==="/library/sections"?{Directory:[{key:"1",type:"movie"}]}:url.pathname.endsWith("/children")?{librarySectionID:1,Metadata:[{ratingKey:"3",title:"Film",type:"movie"}],size:1,totalSize:1}:{Metadata:[{ratingKey:"10",title:"Allowed"}],size:1,totalSize:1})));
        const r=await plexCollectionRead(config,new Set(["1"]),{offset:0,limit:20},"10");expect(r.items).toHaveLength(1);expect(r.items[0]).toMatchObject({libraryKey:"1",title:"Film"});
    });
    it("sorts and filters collections before pagination across allowed libraries",async()=>{
        const fetch=vi.fn(async(url:URL)=>response(url.pathname==="/library/sections"?{Directory:[{key:"1",type:"movie"},{key:"2",type:"show"},{key:"9",type:"movie"}]}:url.pathname.includes("/1/")?{Metadata:[{ratingKey:"10",title:"Saga Z"}],size:1,totalSize:1}:{Metadata:[{ratingKey:"11",title:"Saga A"}],size:1,totalSize:1}));vi.stubGlobal("fetch",fetch);
        const r=await plexCollectionRead(config,new Set(["1","2"]),{offset:0,limit:1,q:"Saga"});expect(r.items).toHaveLength(1);expect(r.items[0]).toMatchObject({title:"Saga A",libraryKey:"2"});expect(r.pagination.hasMore).toBe(true);expect(fetch.mock.calls.map(c=>String(c[0])).join(" ")).not.toContain("/sections/9/");
    });
    it("rejects a hoisted library contradiction before returning content",async()=>{
        vi.stubGlobal("fetch",vi.fn(async(url:URL)=>response(url.pathname==="/library/sections"?{Directory:[{key:"1",type:"movie"}]}:url.pathname.endsWith("/children")?{librarySectionID:9,Metadata:[{ratingKey:"3",title:"Hidden",type:"movie"}],size:1,totalSize:1}:{Metadata:[{ratingKey:"10",title:"Allowed"}],size:1,totalSize:1})));
        await expect(plexCollectionRead(config,new Set(["1"]),{offset:0,limit:20},"10")).rejects.toMatchObject({code:"PLEX_UNREACHABLE"});
    });
    it("matches exact external IDs, never title only", async () => { vi.stubGlobal("fetch", vi.fn(async (url: URL) => response(url.pathname === "/library/sections" ? { Directory: [{ key: "1", type: "movie" }] } : { Metadata: [{ ratingKey: "3", title: "Same title", type: "movie", librarySectionID: "1", Guid: [{ id: "tmdb://551" }] }, { ratingKey: "4", title: "Other title", type: "movie", librarySectionID: "1", Guid: [{ id: "tmdb://550" }] }], size: 2, totalSize: 2 }))); const r = await plexExactAvailability(config, new Set(["1"]), "movie", 550); expect(r.items.map(i => i.ratingKey)).toEqual(["4"]); });
});

describe("Review regressions: Plex absence needs evidence",()=>{
 it.each([[null],[{}],[{key:"1"}],[{type:"movie"}]])("rejects malformed discovery %j",async Directory=>{
  vi.stubGlobal("fetch",vi.fn(async()=>response({Directory})));
  await expect(plexExactAvailability(config,new Set(["1"]),"movie",550)).rejects.toMatchObject({code:"PLEX_UNREACHABLE"});
 });
 it.each([
  {type:"movie" as const,guid:"com.plexapp.agents.themoviedb://550?lang=fr"},
  {type:"series" as const,guid:"com.plexapp.agents.thetvdb://550?lang=fr"}
 ])("matches legacy exact identifiers %j",async({type,guid})=>{
  vi.stubGlobal("fetch",vi.fn(async(url:URL)=>response(url.pathname==="/library/sections"?{Directory:[{key:"1",type:type==="movie"?"movie":"show"}]}:{Metadata:[{ratingKey:"1",title:"Film",type:type==="movie"?"movie":"show",guid}],size:1,totalSize:1})));
  expect(await plexExactAvailability(config,new Set(["1"]),type,550)).toMatchObject({state:"known",present:true});
 });
 it("does not declare absent if relevant media have no usable external ID",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(url:URL)=>response(url.pathname==="/library/sections"?{Directory:[{key:"1",type:"movie"}]}:{Metadata:[{ratingKey:"1",title:"Film",type:"movie",guid:"plex://movie/local-only"}],size:1,totalSize:1})));
  await expect(plexExactAvailability(config,new Set(["1"]),"movie",550)).rejects.toMatchObject({code:"PLEX_IDENTIFIERS_UNAVAILABLE"});
 });
});


describe("Plex collection compatibility", () => {
 it("accepts Directory collection lists and uses canonical read-only metadata children", async () => {
  const fetcher=vi.fn(async(url:URL,init:RequestInit)=>{
   expect(init.method ?? "GET").toBe("GET");
   if(url.pathname==="/library/sections") return response({Directory:[{key:"1",type:"movie"}]});
   if(url.pathname==="/library/sections/1/collections") return response({Directory:[{ratingKey:"10",title:"Saga",type:"collection"}],size:1,totalSize:1});
   expect(url.pathname).toBe("/library/metadata/10/children");
   return response({Metadata:[{ratingKey:"3",title:"Film",type:"movie"}],size:1,totalSize:1});
  });
  vi.stubGlobal("fetch",fetcher);
  const result=await plexCollectionRead(config,new Set(["1"]),{offset:0,limit:20},"10");
  expect(result.items).toMatchObject([{ratingKey:"3",libraryKey:"1",title:"Film"}]);
 });
});

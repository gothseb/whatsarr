import { afterEach, describe, expect, it, vi } from "vitest";
import { PlexService } from "./plex.service";
const settings=(config:unknown={baseUrl:"http://plex.test/prefix",apiKey:"private-token"})=>({getDecryptedService:vi.fn(async()=>config)});
const body=(container:unknown)=>new Response(JSON.stringify({MediaContainer:container}),{headers:{"content-type":"application/json"}});
const query={q:"alien",offset:0,limit:1};
describe("Plex Hermes catalogue",()=>{
 afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
 it("globally sorts and deduplicates after filtering with subsequent pages",async()=>{
  const f=vi.fn(async(url:URL)=>{
   if(url.pathname.endsWith("/sections"))return body({Directory:[{key:1,type:"movie",title:"Films"},{key:2,type:"show",title:"Series"}]});
   const start=Number(url.searchParams.get("X-Plex-Container-Start"));
   if(url.pathname.includes("/1/"))return start===0?body({offset:0,totalSize:3,size:2,Metadata:[{ratingKey:1,title:"Other",type:"movie"},{ratingKey:2,title:"Alien Z",type:"movie",addedAt:1}]}):body({offset:2,totalSize:3,size:1,Metadata:[{ratingKey:2,title:"Alien Z",type:"movie"}]});
   return body({offset:0,totalSize:1,size:1,Metadata:[{ratingKey:2,title:"ALIEN A",type:"show",year:2020,Genre:[{tag:"SF"}],summary:"Synopsis",addedAt:2,token:"hidden",file:"/private"}]});
  });vi.stubGlobal("fetch",f);const service=new PlexService(settings() as never);
  const result=await service.searchMedia(query);expect(result.items).toHaveLength(1);expect(result.items[0]).toMatchObject({title:"ALIEN A",mediaType:"series",libraryKey:"2",ratingKey:"2",genres:["SF"]});expect(result.pagination.hasMore).toBe(true);
  expect((await service.searchMedia({...query,offset:1})).items[0].title).toBe("Alien Z");
  expect(JSON.stringify(result)).not.toMatch(/hidden|private|token|file/);
  for(const [url,options] of f.mock.calls as any){expect(url.href).not.toContain("private-token");expect(options.headers['X-Plex-Token']).toBe("private-token");expect(options.redirect).toBe("error");expect(url.pathname).toContain("/prefix/");}
 });
 it("distinguishes missing libraries from an existing incompatible library",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>body({Directory:[{key:"3",type:"artist",title:"Music"}]})));const service=new PlexService(settings() as never);
  await expect(service.searchMedia({...query,libraryKey:"99"})).rejects.toMatchObject({code:"PLEX_LIBRARY_NOT_FOUND"});
  expect((await service.searchMedia({...query,libraryKey:"3"})).items).toEqual([]);
 });
 it.each([[null,"PLEX_NOT_CONFIGURED"],[{baseUrl:"http://p",apiKey:""},"PLEX_NOT_CONFIGURED"]])("handles incomplete config",async(config,code)=>{await expect(new PlexService(settings(config) as never).searchMedia(query)).rejects.toMatchObject({code});});
 it.each([401,403])("rejects upstream auth %s",async status=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response("secret",{status})));await expect(new PlexService(settings() as never).searchMedia(query)).rejects.toMatchObject({code:"PLEX_AUTHENTICATION_ERROR"});});
 it.each(["broken", "{}", '{"MediaContainer":{"error":"bad"}}'])("rejects malformed response %s",async payload=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response(payload)));await expect(new PlexService(settings() as never).searchMedia(query)).rejects.toMatchObject({code:"PLEX_UNREACHABLE"});});
 it("detects upstream pages repeated without progress",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(url:URL)=>url.pathname.endsWith("/sections")?body({Directory:[{key:1,type:"movie",title:"Films"}]}):body({totalSize:500,size:1,Metadata:[{ratingKey:1,title:"Alien",type:"movie"}]})));
  await expect(new PlexService(settings() as never).searchMedia(query)).rejects.toMatchObject({code:"PLEX_UNREACHABLE"});
 });
 it("returns a real empty search",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(url:URL)=>url.pathname.endsWith("/sections")?body({Directory:[{key:1,type:"movie",title:"Films"}]}):body({size:0,totalSize:0})));
  expect(await new PlexService(settings() as never).searchMedia(query)).toEqual({items:[],pagination:{offset:0,limit:1,hasMore:false},source:"plex"});
 });
 it("times out a stalled body and cancels it",async()=>{
  vi.useFakeTimers();let canceled=false;vi.stubGlobal("fetch",vi.fn(async()=>new Response(new ReadableStream({cancel(){canceled=true;}}))));
  const expectation=expect(new PlexService(settings() as never).searchMedia(query)).rejects.toMatchObject({code:"PLEX_TIMEOUT"});await vi.advanceTimersByTimeAsync(15000);await expectation;expect(canceled).toBe(true);
 });
 it("rejects oversized bodies and unreachable network with stable errors",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("{}",{headers:{"Content-Length":"4194305"}})));
  await expect(new PlexService(settings() as never).searchMedia(query)).rejects.toMatchObject({code:"PLEX_UNREACHABLE"});
  vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("http://secret-host?token=hidden");}));
  await expect(new PlexService(settings() as never).searchMedia(query)).rejects.toMatchObject({code:"PLEX_UNREACHABLE",message:expect.not.stringContaining("hidden")});
 });
 it("shares the deadline across pages",async()=>{
  vi.useFakeTimers();let call=0;vi.stubGlobal("fetch",vi.fn(async()=>{
   call++;await vi.advanceTimersByTimeAsync(call===1?8000:8000);
   return call===1?body({Directory:[{key:1,type:"movie",title:"Films"}]}):body({size:0,totalSize:0});
  }));
  await expect(new PlexService(settings() as never).searchMedia(query)).rejects.toMatchObject({code:"PLEX_TIMEOUT"});
 });
 it("preserves legacy JSON/XML users and sections",async()=>{
  const f=vi.fn().mockResolvedValueOnce(new Response('<MediaContainer><User id="42" username="alice" title="Alice"/></MediaContainer>')).mockResolvedValueOnce(body({Directory:[{key:1,title:"Films",type:"movie"}]}));vi.stubGlobal("fetch",f);
  const service=new PlexService(settings() as never);expect(await service.fetchUsers()).toEqual([{plexUserId:"42",username:"alice",displayName:"Alice"}]);expect(await service.fetchLibraries()).toEqual([{key:"1",title:"Films",type:"movie"}]);
 });
});

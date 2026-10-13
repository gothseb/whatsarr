import "reflect-metadata";
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AgentCataloguePipe, AgentSearchPipe, AgentRecentPipe } from "./agent-media.dto";
import { configureAgentHttp } from "./agent-exception.filter";
import { PlexService } from "../plex/plex.service";
const response=(data:unknown)=>new Response(JSON.stringify({MediaContainer:data}));
describe("Hermes media HTTP boundary",()=>{
 let app:INestApplication, base:string;
 const notifications={createAgentJob:vi.fn()},whatsapp={getServerGroup:vi.fn()},settings={getDecryptedService:vi.fn(async()=>({baseUrl:"http://plex.local",apiKey:"private"}))};
 const f=vi.fn();
 const selectedLibraries = { monthlyRecapLibrary: { findMany: vi.fn(async () => [{ plexKey: "1" }, { plexKey: "2" }]) } };
 beforeAll(async()=>{
  const module=await Test.createTestingModule({controllers:[AgentController],providers:[AgentCataloguePipe,AgentSearchPipe,AgentRecentPipe,{provide:AgentService,useFactory:()=>new AgentService(notifications as never,whatsapp as never,new PlexService(settings as never), {history:vi.fn()} as never, selectedLibraries as never)}]}).compile();
  app=module.createNestApplication();app.setGlobalPrefix("api");configureAgentHttp(app);app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.listen(0,"127.0.0.1");base=await app.getUrl();
 });
 afterAll(async()=>{await app.close();});beforeEach(()=>{f.mockReset();selectedLibraries.monthlyRecapLibrary.findMany.mockReset().mockResolvedValue([{plexKey:"1"},{plexKey:"2"}]);settings.getDecryptedService.mockResolvedValue({baseUrl:"http://plex.local",apiKey:"private"});vi.stubGlobal("fetch",f);});afterEach(()=>vi.unstubAllGlobals());
 // Capture the real fetch before replacing upstream fetch: HTTP client must stay real.
 const clientFetch=globalThis.fetch;
 const get=(query:string)=>clientFetch(`${base}/api/agent/media/search${query}`);
 it("serves searches independently of WhatsApp and returns normalized fields",async()=>{
  f.mockImplementation(async(url:URL)=>url.pathname.endsWith("/sections")?response({Directory:[{key:1,type:"movie",title:"Films"}]}):response({size:1,totalSize:1,Metadata:[{ratingKey:1,type:"movie",title:"Alien"}]}));
  const r=await get("?q=%20ALiEn%20&limit=1");expect(r.status).toBe(200);expect(await r.json()).toMatchObject({items:[{title:"Alien",summary:null,genres:[],addedAt:null}],pagination:{offset:0,limit:1,hasMore:false},source:"plex"});expect(whatsapp.getServerGroup).not.toHaveBeenCalled();expect(notifications.createAgentJob).not.toHaveBeenCalled();
 });
 it.each(["", "?q=", "?q=%20", "?q=x&q=y", "?q[]=x", "?q=x&mediaType=episode", "?q=x&offset=-1", "?q=x&offset=1.5", "?q=x&offset=Infinity", "?q=x&limit=0", "?q=x&limit=101", "?q=x&libraryKey=", "?q=x&cmd=delete", "?q="+"a".repeat(201),"?q=x&offset=9007199254740992"])("rejects invalid query %s before source access",async query=>{
  const r=await get(query);expect(r.status).toBe(400);expect((await r.json() as any).error).toMatchObject({code:"AGENT_INVALID_REQUEST",requestId:expect.any(String)});expect(f).not.toHaveBeenCalled();
 });
 it.each([1,100])("accepts bounds limit=%i",async limit=>{
  f.mockResolvedValue(response({size:0,Directory:[]}));const r=await get(`?q=${"a".repeat(200)}&limit=${limit}`);expect(r.status).toBe(200);
 });
 it.each(["?mediaType=season","?q=alien","?libraryKey=","?offset=-1","?limit=101","?mediaType=movie&mediaType=episode"])("validates recent query %s",async query=>{
  const r=await clientFetch(`${base}/api/agent/media/recent${query}`);expect(r.status).toBe(400);expect(f).not.toHaveBeenCalled();
 });
 it("serves episodes on recent only and never creates notifications",async()=>{
  f.mockImplementation(async(url:URL)=>url.pathname.endsWith("/sections")?response({Directory:[{key:2,type:"show",title:"Series"}]}):response({size:1,totalSize:1,Metadata:[{ratingKey:5,type:"episode",title:"Pilot",parentIndex:0,index:0,addedAt:100}]}));
  const r=await clientFetch(`${base}/api/agent/media/recent?mediaType=episode`);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({items:[{mediaType:"episode",seasonNumber:0,episodeNumber:0}],source:"plex"});expect(whatsapp.getServerGroup).not.toHaveBeenCalled();expect(notifications.createAgentJob).not.toHaveBeenCalled();
 });
 it("maps source failures without leaking the settings or upstream body",async()=>{
  f.mockResolvedValue(new Response("private-token",{status:401}));const r=await get("?q=Alien");expect(r.status).toBe(502);const error=await r.json() as any;expect(error.error.code).toBe("PLEX_AUTHENTICATION_ERROR");expect(JSON.stringify(error)).not.toContain("private");
 });
 it("lists all films and series from recap libraries, filtering before pagination and never fetching excluded catalogues",async()=>{
  const titles={"1":[{ratingKey:1,type:"movie",title:"Zebra"},{ratingKey:2,type:"movie",title:"Alien"}],"2":[{ratingKey:3,type:"show",title:"Dark"}]};
  f.mockImplementation(async(url:URL)=>{
    if(url.pathname.endsWith("/sections"))return response({Directory:[{key:9,type:"movie",title:"Private"},{key:1,type:"movie",title:"Films"},{key:2,type:"show",title:"Series"}]});
    const key=url.pathname.split("/")[3] as keyof typeof titles;
    if(!titles[key])throw new Error("Excluded library must never be fetched");
    return response({size:titles[key].length,totalSize:titles[key].length,Metadata:titles[key]});
  });
  const r=await clientFetch(`${base}/api/agent/media/catalogue?offset=1&limit=1`);
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({items:[{title:"Dark",mediaType:"series",libraryKey:"2"}],pagination:{offset:1,limit:1,hasMore:true},source:"plex"});
  expect(selectedLibraries.monthlyRecapLibrary.findMany).toHaveBeenCalledWith({where:{included:true},select:{plexKey:true}});
  expect(f.mock.calls.some(([url])=>(url as URL).pathname.includes("/sections/9/"))).toBe(false);
  expect(notifications.createAgentJob).not.toHaveBeenCalled();
 });
 it.each(["catalogue","search?q=Alien","recent"])("returns no Plex items and performs no upstream call when no recap library is selected: %s",async route=>{
  selectedLibraries.monthlyRecapLibrary.findMany.mockResolvedValue([]);
  const r=await clientFetch(`${base}/api/agent/media/${route}`);
  expect(r.status).toBe(200);expect(await r.json()).toMatchObject({items:[],pagination:{hasMore:false},source:"plex"});expect(f).not.toHaveBeenCalled();
 });
 it.each(["catalogue?libraryKey=9","search?q=Alien&libraryKey=9","recent?libraryKey=9"])("refuses explicit access to an excluded library before Plex access: %s",async route=>{
  const r=await clientFetch(`${base}/api/agent/media/${route}`);expect(r.status).toBe(404);expect(await r.json()).toMatchObject({error:{code:"PLEX_LIBRARY_NOT_FOUND"}});expect(f).not.toHaveBeenCalled();
 });
 it.each(["search?q=Alien","recent?mediaType=movie"])("applies recap scope on existing route %s",async route=>{
  selectedLibraries.monthlyRecapLibrary.findMany.mockResolvedValue([{plexKey:"1"}]);
  f.mockImplementation(async(url:URL)=>url.pathname.endsWith("/sections")?response({Directory:[{key:1,type:"movie"},{key:9,type:"movie"}]}):response({size:1,totalSize:1,Metadata:[{ratingKey:1,type:"movie",title:"Alien"}]}));
  const r=await clientFetch(`${base}/api/agent/media/${route}`);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({items:[{libraryKey:"1",title:"Alien"}]});expect(f.mock.calls.some(([url])=>(url as URL).pathname.includes("/sections/9/"))).toBe(false);
 });
 it("observes changes to recap selection on the next call",async()=>{
  selectedLibraries.monthlyRecapLibrary.findMany.mockResolvedValueOnce([{plexKey:"1"}]).mockResolvedValueOnce([]);
  f.mockImplementation(async(url:URL)=>url.pathname.endsWith("/sections")?response({Directory:[{key:1,type:"movie"}]}):response({size:1,totalSize:1,Metadata:[{ratingKey:1,type:"movie",title:"Alien"}]}));
  expect(await (await clientFetch(`${base}/api/agent/media/catalogue`)).json()).toMatchObject({items:[{title:"Alien"}]});
  f.mockClear();
  expect(await (await clientFetch(`${base}/api/agent/media/catalogue`)).json()).toMatchObject({items:[]});expect(f).not.toHaveBeenCalled();
 });
 it.each(["?mediaType=episode","?q=Alien","?limit=0","?limit=101","?offset=-1","?libraryKey=","?libraryKey=1&libraryKey=2","?mediaType=movie&mediaType=series"])("validates catalogue query %s before reading the configuration",async query=>{
  const r=await clientFetch(`${base}/api/agent/media/catalogue${query}`);expect(r.status).toBe(400);expect(f).not.toHaveBeenCalled();expect(selectedLibraries.monthlyRecapLibrary.findMany).not.toHaveBeenCalled();
 });
 it.each(["movie","series"])("filters the catalogue by type %s",async mediaType=>{
  f.mockImplementation(async(url:URL)=>url.pathname.endsWith("/sections")?response({Directory:[{key:1,type:"movie"},{key:2,type:"show"}]}):response({size:1,totalSize:1,Metadata:[{ratingKey:1,type:mediaType==="movie"?"movie":"show",title:"Title"}]}));
  const r=await clientFetch(`${base}/api/agent/media/catalogue?mediaType=${mediaType}`);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({items:[{mediaType}]});
  expect(f.mock.calls).toHaveLength(2);
 });
});

import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentArrController } from "./agent-arr.controller";
import { AgentRequestsController } from "./agent-requests.controller";
import { AgentCollectionsController } from "./agent-collections.controller";
import { AgentArrService } from "./agent-arr.service";
import { AgentRequestsService } from "./agent-requests.service";
import { AgentAvailabilityService } from "./agent-availability.service";
import { AgentService } from "./agent.service";
import { PlexService } from "../plex/plex.service";
import { configureAgentHttp } from "./agent-exception.filter";
const arr={list:vi.fn(),tags:vi.fn(),options:vi.fn(),lookup:vi.fn(),add:vi.fn()},requests={list:vi.fn(),detail:vi.fn()},agent={recapLibraries:vi.fn(async()=>new Set(["1"]))},plex={collections:vi.fn()},availability={check:vi.fn()};
let app:INestApplication;
let base:string;
function request(_server:unknown){
 const operation=(path:string,method:string,body?:unknown)=>({
  send:(next:unknown)=>operation(path,method,next),
  expect:async(status:number)=>{const res=await fetch(base+path,{method,...(body===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})});expect(res.status).toBe(status);const text=await res.text();return {body:text?JSON.parse(text):null};}
 });
 return {get:(path:string)=>operation(path,"GET"),post:(path:string)=>operation(path,"POST")};
}
beforeAll(async()=>{const module=await Test.createTestingModule({controllers:[AgentArrController,AgentRequestsController,AgentCollectionsController],providers:[{provide:AgentArrService,useValue:arr},{provide:AgentRequestsService,useValue:requests},{provide:AgentService,useValue:agent},{provide:PlexService,useValue:plex},{provide:AgentAvailabilityService,useValue:availability}]}).compile();app=module.createNestApplication();app.setGlobalPrefix("api");configureAgentHttp(app);await app.listen(0,"127.0.0.1");base=await app.getUrl();});afterAll(async()=>app.close());beforeEach(()=>vi.clearAllMocks());
describe("Acquisitions HTTP contract",()=>{
 it.each(["radarr/movies","sonarr/series"])("lists %s with validated filters",async path=>{arr.list.mockResolvedValueOnce({items:[]});await request(app.getHttpServer()).get('/api/agent/'+path+'?limit=10&monitored=true&tagId=2').expect(200);expect(arr.list).toHaveBeenCalledWith(path.split('/')[0],expect.objectContaining({limit:10,monitored:true,tagId:2}));});
 it.each(["radarr/tags","sonarr/tags","radarr/options","sonarr/options"])("wires %s",async path=>{await request(app.getHttpServer()).get('/api/agent/'+path).expect(200);expect(path.endsWith('tags')?arr.tags:arr.options).toHaveBeenCalled();});
 it.each(["radarr/movies?tagId=0","sonarr/series?monitored=1","radarr/options?secret=x","radarr/lookup?tmdbId=1&tmdbId=2","media/availability?mediaType=movie&tmdbId=1&tvdbId=2","media/availability?mediaType=series&tmdbId=1","media/collections/0/items","media/collections?libraryKey=","seerr/requests/0"])("rejects invalid %s with requestId",async path=>{const response=await request(app.getHttpServer()).get('/api/agent/'+path).expect(400);expect(response.body.error.requestId).toBeTypeOf('string');});
 it("sets 201 and defaults for a new movie",async()=>{arr.add.mockResolvedValueOnce({deduplicated:false,item:{id:1}});await request(app.getHttpServer()).post('/api/agent/radarr/movies').send({tmdbId:550,qualityProfileId:1,rootFolderId:1}).expect(201);expect(arr.add).toHaveBeenCalledWith('radarr',expect.objectContaining({externalId:550,monitored:true,search:false}),expect.any(String));});
 it("sets 200 for an existing series",async()=>{arr.add.mockResolvedValueOnce({deduplicated:true,item:{id:1}});await request(app.getHttpServer()).post('/api/agent/sonarr/series').send({tvdbId:42,qualityProfileId:1,rootFolderId:1}).expect(200);});
 it("rejects arbitrary paths and unknown body fields before writing",async()=>{await request(app.getHttpServer()).post('/api/agent/radarr/movies').send({tmdbId:550,qualityProfileId:1,rootFolderId:1,path:'/evil'}).expect(400);expect(arr.add).not.toHaveBeenCalled();});
 it("wires collections to recap keys",async()=>{plex.collections.mockResolvedValueOnce({items:[]});await request(app.getHttpServer()).get('/api/agent/media/collections/123/items?libraryKey=1').expect(200);expect(plex.collections).toHaveBeenCalledWith(expect.objectContaining({libraryKey:'1'}),new Set(['1']),'123');});
 it("wires exact availability identifiers",async()=>{await request(app.getHttpServer()).get('/api/agent/media/availability?mediaType=movie&tmdbId=550').expect(200);expect(availability.check).toHaveBeenCalledWith('movie',550);});
 it("rejects unknown source services",async()=>{await request(app.getHttpServer()).get('/api/agent/other/tags').expect(404);expect(arr.tags).not.toHaveBeenCalled();});
});

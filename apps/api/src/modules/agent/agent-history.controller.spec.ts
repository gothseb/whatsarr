import "reflect-metadata";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AgentHistoryPipe } from "./agent-history.dto";
import { configureAgentHttp } from "./agent-exception.filter";
import { TautulliService } from "../tautulli/tautulli.service";

const json=(data:unknown)=>new Response(JSON.stringify({response:{result:"success",data:{data,recordsFiltered:Array.isArray(data)?data.length:0}}}));
describe("Hermes history HTTP",()=>{
 let app:INestApplication,base:string;
 const settings={getDecryptedService:vi.fn(async()=>({baseUrl:"http://tautulli",apiKey:"private"}))};const f=vi.fn();const sends={createAgentJob:vi.fn()},whatsapp={getServerGroup:vi.fn()};
 const clientFetch=globalThis.fetch;
 beforeAll(async()=>{
  const module=await Test.createTestingModule({controllers:[AgentController],providers:[AgentHistoryPipe,{provide:AgentService,useFactory:()=>new AgentService(sends as never,whatsapp as never,{} as never,new TautulliService(settings as never))}]}).compile();
  app=module.createNestApplication();app.setGlobalPrefix("api");configureAgentHttp(app);app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.listen(0,"127.0.0.1");base=await app.getUrl();
 });
 beforeEach(()=>{f.mockReset();settings.getDecryptedService.mockResolvedValue({baseUrl:"http://tautulli",apiKey:"private"});vi.stubGlobal("fetch",f);});afterEach(()=>vi.unstubAllGlobals());afterAll(async()=>app.close());
 const get=(query="")=>clientFetch(`${base}/api/agent/watch-history${query}`);
 it("returns all-history and single bounded results without a group",async()=>{
  f.mockResolvedValue(json([{row_id:1,user_id:0,media_type:"movie",title:"Old play",started:100,stopped:0,user:"local",percent_complete:0,play_duration:0}]));const r=await get("?userId=0");expect(r.status).toBe(200);expect(await r.json()).toMatchObject({items:[{title:"Old play",userId:"0",stoppedAt:null,durationSeconds:0,progressPercent:0}],source:"tautulli"});
  expect(whatsapp.getServerGroup).not.toHaveBeenCalled();expect(sends.createAgentJob).not.toHaveBeenCalled();
 });
 it.each(["?userId=", "?userId=-1", "?userId=1.5", "?userId=1&userId=2", "?cmd=delete", "?offset=1.5", "?limit=101", "?from=2026-02-30T00:00:00Z", "?from=2026-10-12", "?from=2026-10-12T00:00:00", "?from=2026-10-12T00:00:00Z&to=2026-10-11T00:00:00Z", "?to=2026-10-12T25:00:00Z"])("rejects invalid dates/filters %s before source",async query=>{
  const r=await get(query);expect(r.status).toBe(400);expect((await r.json() as any).error.code).toBe("AGENT_INVALID_REQUEST");expect(f).not.toHaveBeenCalled();
 });
 it("treats offset timezones as UTC instants and excludes the upper bound",async()=>{
  const started=Date.parse("2026-10-12T00:00:00Z")/1000;
  f.mockResolvedValue(json([{row_id:2,title:"Upper",started:started+3600},{row_id:1,title:"Lower",started}]));
  const r=await get("?from=2026-10-12T02%3A00%3A00%2B02%3A00&to=2026-10-12T01%3A00%3A00Z");expect(r.status).toBe(200);expect((await r.json() as any).items.map((i:any)=>i.title)).toEqual(["Lower"]);
 });
 it("allows a single bound or an empty period",async()=>{
  f.mockImplementation(async()=>json([]));expect((await get("?from=2026-10-12T00:00:00Z")).status).toBe(200);expect((await get("?to=2026-10-12T00:00:00Z")).status).toBe(200);
  const r=await get("?from=2026-10-12T00:00:00Z&to=2026-10-12T00:00:00Z");expect(r.status).toBe(200);expect((await r.json() as any).items).toEqual([]);
 });
 it("returns correlated upstream application errors",async()=>{
  f.mockResolvedValue(new Response(JSON.stringify({response:{result:"error",message:"Invalid API key private"}})));const r=await get();expect(r.status).toBe(502);const body=await r.json() as any;expect(body.error).toMatchObject({code:"TAUTULLI_AUTHENTICATION_ERROR",requestId:expect.any(String)});expect(JSON.stringify(body)).not.toContain("private");
 });
});

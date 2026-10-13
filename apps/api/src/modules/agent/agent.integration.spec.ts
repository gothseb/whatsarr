import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaService } from "../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationsController } from "../notifications/notifications.controller";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { configureAgentHttp } from "./agent-exception.filter";
import { AgentMessagePipe } from "./agent.dto";

describe("Hermes HTTP with persistent SQLite", () => {
  let prisma: PrismaService, app: INestApplication, base: string, directory: string;
  const adapter = {sendMessage: vi.fn(async()=>{})};
  const templates = {render:vi.fn(async()=>"legacy")};
  let notifications: NotificationsService;
  const group = {getServerGroup:vi.fn(async()=>({groupId:"initial@g.us"}))};
  const originalAuth = process.env.AUTH_DISABLED;
  beforeAll(async()=>{
    directory=await mkdtemp(join(tmpdir(),"whatsarr-hermes-"));
    prisma=new PrismaService({datasources:{db:{url:`file:${join(directory,"test.db")}`}}});
    await prisma.onModuleInit();
    notifications=new NotificationsService(prisma,templates as never,adapter as never);
    process.env.AUTH_DISABLED="false";
    const module=await Test.createTestingModule({controllers:[AgentController, NotificationsController],providers:[
      {provide:AgentService,useFactory:()=>new AgentService(notifications,group as never,{searchMedia:vi.fn()} as never,{history:vi.fn()} as never, prisma)},
      {provide:NotificationsService,useValue:notifications}, AgentMessagePipe, {provide:AuthGuard,useValue:new AuthGuard(new AuthService(prisma))},
      {provide:AuthService,useValue:new AuthService(prisma)}
    ]}).overrideGuard(AuthGuard).useValue(new AuthGuard(new AuthService(prisma))).compile();
    app=module.createNestApplication();app.setGlobalPrefix("api");configureAgentHttp(app);
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.listen(0,"127.0.0.1");base=await app.getUrl();
  });
  afterAll(async()=>{await app?.close();await prisma?.$disconnect();await rm(directory,{recursive:true,force:true});
    if(originalAuth===undefined)delete process.env.AUTH_DISABLED;else process.env.AUTH_DISABLED=originalAuth;
  });
  const post=async(body:unknown)=>{const r=await fetch(`${base}/api/agent/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return {status:r.status,body:await r.json() as any};};
  it("accepts one winner for ten concurrent requests, keeps target after restart and rejects conflicts",async()=>{
    const input={messageId:"concurrent",text:" {{title}}\nDune "};
    const results=await Promise.all(Array.from({length:10},()=>post(input)));
    expect(results.filter(r=>r.status===202)).toHaveLength(1);
    expect(results.filter(r=>r.status===200)).toHaveLength(9);
    expect(new Set(results.map(r=>r.body.jobId)).size).toBe(1);
    expect(new Set(results.map(r=>r.body.requestId)).size).toBe(10);
    expect(await prisma.notificationJob.count()).toBe(1);
    await prisma.$disconnect();await prisma.$connect();
    group.getServerGroup.mockResolvedValueOnce(null as never);
    const replay=await post(input);expect(replay.status).toBe(200);
    expect(group.getServerGroup).not.toHaveBeenLastCalledWith("concurrent");
    const row=await prisma.notificationJob.findUniqueOrThrow({where:{id:replay.body.jobId}});
    expect(row.targetId).toBe("initial@g.us");
    expect((await post({...input,text:"different"})).status).toBe(409);
    await notifications.processDueJobs();
    expect(adapter.sendMessage).toHaveBeenCalledWith("initial@g.us",input.text,null);
    expect(templates.render).not.toHaveBeenCalled();
  });
  it("rejects new messages without a group",async()=>{
    const r=await post({messageId:"no-group",text:"ok"});expect(r.status).toBe(409);expect(r.body.error.code).toBe("WHATSAPP_GROUP_NOT_SELECTED");
  });
  it("does not expose an admin endpoint without authentication",async()=>{
    expect((await fetch(`${base}/api/notifications/jobs`)).status).toBe(401);
  });
  it.each(["{","null","[]","true","12",'"str"','{"messageId":"a","text":"ok","targetId":"x"}'])('returns correlated safe validation error for %s',async body=>{
    const r=await fetch(`${base}/api/agent/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body});
    expect(r.status).toBe(400);const json=await r.json() as any;
    expect(json.error).toMatchObject({code:"AGENT_INVALID_REQUEST",requestId:expect.any(String)});
    expect(JSON.stringify(json)).not.toMatch(/SyntaxError|stack|node_modules/);
  });
  it("serves the packaged OpenAPI",async()=>{
    const r=await fetch(`${base}/api/agent/openapi.json`);expect(r.status).toBe(200);expect((await r.json() as any).paths['/api/agent/messages']).toBeDefined();
  });
  it("keeps identity when acceptance logging fails and new group affects only new ids",async()=>{
    group.getServerGroup.mockResolvedValue({groupId:"changed@g.us"});
    const log=vi.spyOn(notifications,"log").mockRejectedValueOnce(new Error("SQL secret"));
    const accepted=await post({messageId:"log-outage",text:"ok"});expect(accepted.status).toBe(202);
    log.mockRestore();
    const replay=await post({messageId:"log-outage",text:"ok"});expect(replay.status).toBe(200);expect(replay.body.jobId).toBe(accepted.body.jobId);
    expect((await prisma.notificationJob.findUniqueOrThrow({where:{id:accepted.body.jobId}})).targetId).toBe("changed@g.us");
    expect((await prisma.notificationJob.findUniqueOrThrow({where:{dedupeKey:"job:agent:hermes:concurrent"}})).targetId).toBe("initial@g.us");
  });
  it("deduplicates photo references concurrently and rejects additions/removal/changed URL",async()=>{
    const input={messageId:"photo",text:"caption",imageUrl:"http://hermes/photo.jpg"};
    const results=await Promise.all(Array.from({length:10},()=>post(input)));expect(results.filter(r=>r.status===202)).toHaveLength(1);expect(results.filter(r=>r.status===200)).toHaveLength(9);
    expect((await post({...input,imageUrl:"http://hermes/other.jpg"})).status).toBe(409);
    expect((await post({messageId:"photo",text:"caption"})).status).toBe(409);
    expect((await post({messageId:"concurrent",text:" {{title}}\nDune ",imageUrl:"http://hermes/photo.jpg"})).status).toBe(409);
    const row=await prisma.notificationJob.findUniqueOrThrow({where:{dedupeKey:"job:agent:hermes:photo"}});expect(JSON.parse(row.payloadJson).mediaUrl).toBe(input.imageUrl);
  });
  it("projects all five persistent states without sending, and preserves original requestId",async()=>{
    const row=await prisma.notificationJob.findUniqueOrThrow({where:{dedupeKey:"job:agent:hermes:concurrent"}});
    const sends=adapter.sendMessage.mock.calls.length;
    for(const status of ["pending","processing","retry_scheduled","sent","failed"]){
      await prisma.notificationJob.update({where:{id:row.id},data:{status,attempts:2,lastError:"Error https://u:p@host/image?signature=hidden&cookie=secret\n stack trace"}});
      const response=await fetch(`${base}/api/agent/messages/${row.id}`);expect(response.status).toBe(200);
      const body=await response.json() as any;
      expect(body).toMatchObject({jobId:row.id,messageId:"concurrent",source:"hermes",status,attempts:2,requestId:row.requestId});
      expect(body.lastError).not.toMatch(/hidden|secret|stack|u:p/);
      expect(Object.keys(body).sort()).toEqual(["jobId","messageId","source","status","attempts","createdAt","sentAt","failedAt","lastError","requestId"].sort());
    }
    expect(adapter.sendMessage).toHaveBeenCalledTimes(sends);
    await notifications.retryJob(row.id);
    const retried=await (await fetch(`${base}/api/agent/messages/${row.id}`)).json() as any;
    expect(retried).toMatchObject({status:"pending",attempts:0,failedAt:null,lastError:null,requestId:row.requestId});
    await prisma.$disconnect();await prisma.$connect();
    expect((await fetch(`${base}/api/agent/messages/${row.id}`)).status).toBe(200);
  });
  it("hides missing, non-Hermes and malformed jobs",async()=>{
    for(const [id,type,payloadJson] of [["legacy","announcement","{}"],["corrupt","agent_message","null"],["other","agent_message",JSON.stringify({kind:"agent_message",source:"other",messageId:"x",text:"hi",mediaUrl:null})]]){
      await prisma.notificationJob.create({data:{id,type,targetType:"group",targetId:"secret-group",dedupeKey:id,payloadJson}});
      const response=await fetch(`${base}/api/agent/messages/${id}`);expect(response.status).toBe(404);expect((await response.json() as any).error.code).toBe("AGENT_MESSAGE_NOT_FOUND");
    }
    const response=await fetch(`${base}/api/agent/messages/missing`);expect(response.status).toBe(404);expect((await response.json() as any).error.requestId).toEqual(expect.any(String));
  });
  it("keeps admin job arrays with safe Hermes metadata and correlated logs",async()=>{
    const jobs=await notifications.listJobs();const photo=jobs.find(j=>j.type==="agent_message"&&(j as any).messageId==="photo") as any;
    expect(photo.source).toBe("hermes");expect(JSON.stringify(photo.payload)).not.toContain("http://hermes");
    await post({messageId:"photo",text:"caption",imageUrl:"http://hermes/photo.jpg"});
    const logs=await notifications.listLogs();const duplicate=logs.find(l=>l.event==="agent.message.deduplicated") as any;
    expect(duplicate.context).toMatchObject({source:"hermes",messageId:"photo",jobId:photo.id,originRequestId:photo.requestId});expect(duplicate.requestId).not.toBe(photo.requestId);
  });
  it("keeps correlation on equivalent case-insensitive Express routes",async()=>{
    const response=await fetch(`${base}/API/AGENT/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messageId:"upper-case-route",text:"ok"})});expect(response.status).toBe(202);
    const body=await response.json() as any;expect(body.requestId).toEqual(expect.any(String));expect((await prisma.notificationJob.findUniqueOrThrow({where:{id:body.jobId}})).requestId).toBe(body.requestId);
  });
  it("keeps a single original job for concurrent conflicting payloads",async()=>{
    const results=await Promise.all(Array.from({length:10},(_,i)=>post({messageId:"mixed",text:i%2?"A":"B"})));
    expect(results.filter(r=>r.status===202)).toHaveLength(1);
    expect(results.filter(r=>r.status===409)).toHaveLength(5);
    expect(await prisma.notificationJob.count({where:{dedupeKey:"job:agent:hermes:mixed"}})).toBe(1);
  });
});

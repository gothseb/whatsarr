import { afterEach, describe, expect, it, vi } from "vitest";
import { TautulliService } from "./tautulli.service";
const settings=(value:unknown={baseUrl:"http://tautulli.test/root",apiKey:"secret-key"})=>({getDecryptedService:vi.fn(async()=>value)});
const history=(data:unknown[],total?:number)=>new Response(JSON.stringify({response:{result:"success",message:null,data:{data,...(total===undefined?{}:{recordsFiltered:total})}}}));
const row=(id:number,started:number,overrides:Record<string,unknown>={})=>({row_id:id,user_id:42,user:"alice@example.test",friendly_name:"Alice",title:"Film",media_type:"movie",rating_key:123,section_id:1,started,stopped:started+100,play_duration:0,percent_complete:0,ip_address:"10.0.0.1",session_key:"private",...overrides});
const query={offset:0,limit:2};
describe("Tautulli read-only Hermes history",()=>{
 afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
 it("normalizes plays and keeps repeated views distinct",async()=>{
  const f=vi.fn(async()=>history([row(1,500),row(2,400,{media_type:"episode",title:"Pilot",grandparent_title:"Show",parent_media_index:0,media_index:0,play_duration:42,percent_complete:95})],2));vi.stubGlobal("fetch",f);
  const result=await new TautulliService(settings() as never).history(query);expect(result.items).toHaveLength(2);expect(result.items[0]).toMatchObject({userId:"42",userName:"Alice",durationSeconds:0,progressPercent:0,ratingKey:"123",libraryKey:"1"});expect(result.items[1]).toMatchObject({mediaType:"episode",seriesTitle:"Show",seasonNumber:0,episodeNumber:0,durationSeconds:42,progressPercent:95});expect(JSON.stringify(result)).not.toMatch(/example.test|10.0.0.1|private|apikey/);
  const [url,options]=f.mock.calls[0] as any;expect(url.pathname).toBe("/root/api/v2");expect(url.searchParams.get("cmd")).toBe("get_history");expect(url.searchParams.get("grouping")).toBe("0");expect(url.searchParams.get("include_activity")).toBe("0");expect(url.searchParams.get("order_column")).toBe("started");expect(options.redirect).toBe("error");
 });
 it("filters exact UTC bounds before offset across empty matching pages",async()=>{
  const f=vi.fn().mockResolvedValueOnce(history([row(1,500),row(2,400)],5)).mockResolvedValueOnce(history([row(3,300),row(4,200)],5)).mockResolvedValueOnce(history([row(5,100)],5));vi.stubGlobal("fetch",f);
  const result=await new TautulliService(settings() as never).history({...query,from:"1970-01-01T00:03:20Z",to:"1970-01-01T00:06:40Z",offset:1,limit:1});expect(result.items[0].startedAt).toBe("1970-01-01T00:03:20.000Z");expect(result.pagination.hasMore).toBe(false);
  expect((f.mock.calls[1][0] as URL).searchParams.get("start")).toBe("2");expect((f.mock.calls[0][0] as URL).searchParams.has("after")).toBe(false);
 });
 it("finishes equal timestamp blocks before slicing and uses row_id descending",async()=>{
  const f=vi.fn().mockResolvedValueOnce(history([row(1,500),row(2,500)],5)).mockResolvedValueOnce(history([row(3,500),row(4,500)],5)).mockResolvedValueOnce(history([row(5,400)],5));vi.stubGlobal("fetch",f);
  const result=await new TautulliService(settings() as never).history({...query,limit:1});expect(result.items[0].stoppedAt).toBe("1970-01-01T00:10:00.000Z");expect(f).toHaveBeenCalledTimes(3);expect(result.pagination.hasMore).toBe(true);
  // Give each tied row a visible unique title to confirm deterministic id order.
  f.mockReset().mockResolvedValueOnce(history([row(1,500,{title:"one"}),row(2,500,{title:"two"})],3)).mockResolvedValueOnce(history([row(3,500,{title:"three"})],3));
  expect((await new TautulliService(settings() as never).history({...query,limit:1})).items[0].title).toBe("three");
 });
 it("retains missing dates only without a temporal filter and masks email names",async()=>{
  const data=[row(1,500,{friendly_name:"name@example.test",user:"fallback"}),row(2,0,{friendly_name:"a@b.c",user:"a@b.c",play_duration:null,percent_complete:500})];
  vi.stubGlobal("fetch",vi.fn(async()=>history(data,2)));const service=new TautulliService(settings() as never);const result=await service.history(query);
  expect(result.items[0].userName).toBe("fallback");expect(result.items[1]).toMatchObject({userName:null,startedAt:null,durationSeconds:null,progressPercent:null});expect((await service.history({...query,from:"1970-01-01T00:00:00Z"})).items).toHaveLength(1);
 });
 it("passes user filter and verifies returned ids without mandatory mappings",async()=>{
  const f=vi.fn(async()=>history([row(1,500,{user_id:0}),row(2,400,{user_id:42})],2));vi.stubGlobal("fetch",f);
  expect((await new TautulliService(settings() as never).history({...query,userId:"0"})).items).toHaveLength(1);expect(((f.mock.calls as any)[0][0]).searchParams.get("user_id")).toBe("0");
 });
 it("treats an empty period and unknown user as genuine empty results",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>history([],0)));const service=new TautulliService(settings() as never);expect((await service.history({...query,userId:"999"})).items).toEqual([]);expect((await service.history({...query,from:"2026-10-12T00:00:00Z",to:"2026-10-12T00:00:00Z"})).pagination.hasMore).toBe(false);
 });
 it.each([["Invalid API key","TAUTULLI_AUTHENTICATION_ERROR"],["Database unavailable token=private","TAUTULLI_UNREACHABLE"]])("checks application error with HTTP200",async(message,code)=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({response:{result:"error",message,data:null}}))));await expect(new TautulliService(settings() as never).history(query)).rejects.toMatchObject({code,message:expect.not.stringContaining("private")});
 });
 it.each(["{}",'null','{"response":{"result":"success","data":null}}',"broken"])("rejects malformed data %s",async data=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(data)));await expect(new TautulliService(settings() as never).history(query)).rejects.toMatchObject({code:"TAUTULLI_UNREACHABLE"});
 });
 it("rejects repeated pages, inconsistent total or unordered source",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>history([row(1,500)],100)));await expect(new TautulliService(settings() as never).history({...query,limit:100})).rejects.toMatchObject({code:"TAUTULLI_UNREACHABLE"});
  vi.stubGlobal("fetch",vi.fn(async()=>history([row(1,400),row(2,500)],2)));await expect(new TautulliService(settings() as never).history(query)).rejects.toMatchObject({code:"TAUTULLI_UNREACHABLE"});
 });
 it("handles source missing/auth failure/timeout",async()=>{
  await expect(new TautulliService(settings(null) as never).history(query)).rejects.toMatchObject({code:"TAUTULLI_NOT_CONFIGURED"});
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("secret",{status:403})));await expect(new TautulliService(settings() as never).history(query)).rejects.toMatchObject({code:"TAUTULLI_AUTHENTICATION_ERROR"});
  vi.useFakeTimers();vi.stubGlobal("fetch",vi.fn(async()=>new Response(new ReadableStream())));
  const promise=expect(new TautulliService(settings() as never).history(query)).rejects.toMatchObject({code:"TAUTULLI_TIMEOUT"});await vi.advanceTimersByTimeAsync(15000);await promise;
 });
});

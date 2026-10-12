import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentImageService } from "./agent-image.service";
const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
const jpeg=Buffer.from([255,216,255,224,0]);
const respond=(data:Buffer,type="image/png",headers:Record<string,string>={})=>new Response(new Uint8Array(data).buffer,{headers:{"Content-Type":type,...headers}});
describe("Hermes photo downloader",()=>{
 afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
 it.each([[png,"image/png"],[jpeg,"image/jpeg"]])("keeps controlled bytes and supports LAN %s",async(data,type)=>{
  const fetcher=vi.fn(async()=>respond(data as Buffer,type as string));vi.stubGlobal("fetch",fetcher);
  const media=await new AgentImageService().download("http://192.168.1.2/photo");
  expect(media.data).toEqual(data);expect(media.mimetype).toBe(type);expect(fetcher).toHaveBeenCalledOnce();
 });
 it.each([[Buffer.from("html"),"image/png"],[png,"image/jpeg"],[png,"text/html"],[Buffer.alloc(0),"image/png"]])("rejects bad MIME/signature",async(data,type)=>{
  vi.stubGlobal("fetch",vi.fn(async()=>respond(data as Buffer,type as string)));
  await expect(new AgentImageService().download("http://hermes/image")).rejects.toThrow("AGENT_IMAGE_INVALID");
 });
 it("checks actual bytes even with lying Content-Length",async()=>{
  const data=Buffer.alloc(10*1024*1024+1);png.copy(data);vi.stubGlobal("fetch",vi.fn(async()=>respond(data,"image/png",{"Content-Length":"1"})));
  await expect(new AgentImageService().download("http://hermes/image")).rejects.toThrow("AGENT_IMAGE_TOO_LARGE");
 });
 it("accepts exact size limit",async()=>{
  const data=Buffer.alloc(10*1024*1024);png.copy(data);vi.stubGlobal("fetch",vi.fn(async()=>respond(data)));
  expect((await new AgentImageService().download("http://hermes/image")).filesize).toBe(data.length);
 });
 it("follows relative redirects without forwarding headers",async()=>{
  const f=vi.fn().mockResolvedValueOnce(new Response(null,{status:302,headers:{Location:"/photo"}})).mockResolvedValueOnce(respond(png));vi.stubGlobal("fetch",f);
  await new AgentImageService().download("http://hermes/start");expect(String(f.mock.calls[1][0])).toBe("http://hermes/photo");
  expect(f.mock.calls[1][1]).toMatchObject({redirect:"manual"});expect(f.mock.calls[1][1].headers).not.toHaveProperty("Cookie");
 });
 it.each(["file:///etc/passwd","http://u:p@hermes/photo","data:image/png;base64,eA=="])("rejects redirected destination %s",async location=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:302,headers:{Location:location}})));
  await expect(new AgentImageService().download("http://hermes/start")).rejects.toThrow("AGENT_IMAGE_REDIRECT_INVALID");
 });
 it("stops redirect loops",async()=>{
  const f=vi.fn(async()=>new Response(null,{status:302,headers:{Location:"/again"}}));vi.stubGlobal("fetch",f);
  await expect(new AgentImageService().download("http://hermes/start")).rejects.toThrow("AGENT_IMAGE_REDIRECT_INVALID");expect(f).toHaveBeenCalledTimes(6);
 });
 it("aborts a stalled body after the total deadline",async()=>{
  vi.useFakeTimers();let canceled=false;
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(new ReadableStream({cancel(){canceled=true;} }),{headers:{"Content-Type":"image/png"}})));
  const check=expect(new AgentImageService().download("http://hermes/image")).rejects.toThrow("AGENT_IMAGE_TIMEOUT");
  await vi.advanceTimersByTimeAsync(15000);await check;expect(canceled).toBe(true);
 });
 it("rejects too large declared size and HTTP errors safely",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>respond(png,"image/png",{"Content-Length":"10485761"})));
  await expect(new AgentImageService().download("http://hermes/image")).rejects.toThrow("AGENT_IMAGE_TOO_LARGE");
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("secret",{status:403})));
  await expect(new AgentImageService().download("http://hermes/image?token=secret")).rejects.toThrow("AGENT_IMAGE_UNREACHABLE");
 });
});

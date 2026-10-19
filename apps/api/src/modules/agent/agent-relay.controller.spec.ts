import "reflect-metadata";
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe, Controller, Post, Body } from "@nestjs/common";
import { AgentRelayController } from "./agent-relay.controller";
import { AgentRelayService } from "./agent-relay.service";
import { AgentRelayPipe, relayMethods } from "./agent-relay.dto";
import { SettingsService } from "../settings/settings.service";
import { configureAgentHttp } from "./agent-exception.filter";

@Controller("agent/legacy")
class LegacyController { @Post() echo(@Body() body: unknown) { return body; } }
const clientFetch = globalThis.fetch;
const secret="private/key+secret&value";
const defaults={service:"radarr",method:"GET",path:"/api/v3/new-command"};
describe("Generic Hermes relay HTTP",()=>{
 let app:INestApplication,base:string;
 const upstream=vi.fn();
 const settings={getDecryptedService:vi.fn(async(service:string)=>({apiKey:secret,baseUrl:`http://${service}.local/prefix`,username:"stored-user",password:"stored-password"}))};
 beforeAll(async()=>{
  const module=await Test.createTestingModule({controllers:[AgentRelayController,LegacyController],providers:[AgentRelayPipe,AgentRelayService,{provide:SettingsService,useValue:settings}]}).compile();
  app=module.createNestApplication({logger:false});app.setGlobalPrefix("api");configureAgentHttp(app);app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.listen(0,"127.0.0.1");base=await app.getUrl();
 });
 afterAll(async()=>app.close());
 beforeEach(()=>{upstream.mockReset().mockResolvedValue(new Response('{"ok":true}',{headers:{"content-type":"application/json"}}));settings.getDecryptedService.mockImplementation(async(service:string)=>({apiKey:secret,baseUrl:`http://${service}.local/prefix`,username:"stored-user",password:"stored-password"}));vi.stubGlobal("fetch",upstream);});
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
 const call=(payload:unknown,route="relay")=>clientFetch(`${base}/api/agent/${route}`,{method:"POST",headers:{"content-type":"application/json","cookie":"admin-session=must-never-leave","authorization":"Bearer admin"},body:JSON.stringify(payload)});
 it.each(relayMethods)("relays arbitrary native %s exactly once",async method=>{
  const body=method==="GET"||method==="HEAD"?{}:{body:{nested:{seasons:[0,2],unknown:true},arbitrary:"native"}};
  const result=await call({...defaults,method,...body,query:{tag:[1,2],include:false},headers:{Accept:"application/json","X-Custom":"custom"}});
  expect(result.status).toBe(200);expect(await result.json()).toMatchObject({service:"radarr",upstreamStatus:200,body:method==="HEAD"?null:{ok:true},bodyEncoding:method==="HEAD"?"empty":"json",redacted:false,requestId:expect.any(String)});
  expect(upstream).toHaveBeenCalledTimes(1);const [url,init]=upstream.mock.calls[0];expect(url.href).toBe("http://radarr.local/prefix/api/v3/new-command?tag=1&tag=2&include=false");expect(init.method).toBe(method);expect(init.redirect).toBe("manual");expect(init.headers.get("x-api-key")).toBe(secret);expect(init.headers.get("cookie")).toBeNull();expect(init.headers.get("authorization")).toBeNull();if("body"in body)expect(JSON.parse(init.body)).toEqual(body.body);
 });
 it.each(["plex","radarr","sonarr","overseerr","seerr","tautulli","tmdb"])("injects authentication for %s",async service=>{
  const r=await call({...defaults,service,path:service==="tmdb"?"/4/list/1":"/native"});expect(r.status).toBe(200);
  const [url,init]=upstream.mock.calls[0];if(service==="tautulli")expect(url.searchParams.get("apikey")).toBe(secret);else if(service==="tmdb"){expect(url.origin).toBe("https://api.themoviedb.org");expect(url.pathname).toBe("/4/list/1");expect(init.headers.get("authorization")).toBe(`Bearer ${secret}`);}else expect(init.headers.get(service==="plex"?"x-plex-token":"x-api-key")).toBe(secret);
  if(service==="seerr")expect((await r.json()).service).toBe("overseerr");
 });
 it("supports TMDB v3 query keys and fixed origin",async()=>{
  settings.getDecryptedService.mockResolvedValue({apiKey:"a".repeat(32),baseUrl:"http://evil.local",username:"",password:""});
  expect((await call({...defaults,service:"tmdb",path:"/3/discover/movie"})).status).toBe(200);const[url,init]=upstream.mock.calls[0];expect(url.origin).toBe("https://api.themoviedb.org");expect(url.searchParams.get("api_key")).toBe("a".repeat(32));expect(init.headers.has("authorization")).toBe(false);
 });
 it.each([null,[],{},"string",42,false])("preserves arbitrary JSON body %j",async body=>{
  expect((await call({...defaults,method:"POST",body})).status).toBe(200);expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual(body);
 });
 it.each(["text","base64"])("preserves raw %s requests",async bodyEncoding=>{
  const body=bodyEncoding==="text"?"<native>value</native>":"AP8BAg==";
  expect((await call({...defaults,method:"PATCH",bodyEncoding,body,headers:{"Content-Type":"application/custom"}})).status).toBe(200);
  const init=upstream.mock.calls[0][1];expect(bodyEncoding==="text"?init.body:Buffer.from(init.body).toString("base64")).toBe(body);expect(init.headers.get("content-type")).toBe("application/custom");
 });
 it.each([204,304,302,400,401,403,404,422,500,503])("preserves upstream status %i in successful transport envelope",async status=>{
  const empty=status===204||status===304;upstream.mockResolvedValue(new Response(empty?null:'{"error":"native validation"}',{status,headers:{"content-type":"application/json","location":"http://elsewhere.local","retry-after":"2"}}));
  const r=await call(defaults);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({upstreamStatus:status,body:empty?null:{error:"native validation"},bodyEncoding:empty?"empty":"json",headers:{location:"http://elsewhere.local","retry-after":"2"}});expect(upstream).toHaveBeenCalledTimes(1);
 });
 it.each(["text/plain","application/xml","application/json"])("redacts reflected and unknown credentials in %s without losing ratingKey",async contentType=>{
  const value=contentType==="application/json"?JSON.stringify({ratingKey:"123",apiKey:"unknown",deep:[{password:"unknown2"}],url:`http://host/?key=${encodeURIComponent(secret)}`,raw:secret,user:"stored-user"}):`<reply ratingKey="123" apiKey="unknown"><password>unknown-secret</password><raw>${secret}</raw><encoded>${encodeURIComponent(secret)}</encoded></reply>`;
  upstream.mockResolvedValue(new Response(value,{headers:{"content-type":contentType,"set-cookie":"session=unknown","x-api-key":secret,"x-reflected":secret,"location":`http://host/?apikey=${encodeURIComponent(secret)}`}}));
  const result=await (await call(defaults)).json();expect(result.redacted).toBe(true);const text=JSON.stringify(result);expect(text).not.toContain(secret);expect(text).not.toContain(encodeURIComponent(secret));expect(text).not.toContain("unknown");expect(text).toContain("ratingKey");expect(text).toContain("123");expect(result.headers["set-cookie"]).toBeUndefined();expect(result.headers["x-api-key"]).toBeUndefined();
 });
 it("redacts every configured service key, JSON escaped and XML escaped representations",async()=>{
  settings.getDecryptedService.mockImplementation(async service=>({apiKey:service==="sonarr"?'other<&"key':secret,baseUrl:"http://host/prefix",username:"stored-user",password:"stored-password"}));
  upstream.mockResolvedValue(new Response('other&lt;&amp;&quot;key '+Buffer.from(secret).toString("base64"),{headers:{"content-type":"text/plain"}}));
  const r=await(await call(defaults)).json();expect(r.body).toBe("[REDACTED] [REDACTED]");
 });
 it("returns binary bytes as base64",async()=>{upstream.mockResolvedValue(new Response(new Uint8Array([0,255,1]),{headers:{"content-type":"image/png"}}));expect(await(await call(defaults)).json()).toMatchObject({body:"AP8B",bodyEncoding:"base64",redacted:false});});
 it("refuses a binary response containing a known credential",async()=>{upstream.mockResolvedValue(new Response(new TextEncoder().encode(`binary\0${secret}`),{headers:{"content-type":"application/octet-stream"}}));const r=await call(defaults);expect(r.status).toBe(502);expect(await r.json()).toMatchObject({error:{code:"RELAY_SECRET_IN_BINARY",requestId:expect.any(String)}});});
 it("preserves malformed upstream JSON as explicit text",async()=>{upstream.mockResolvedValue(new Response('{"broken":',{headers:{"content-type":"application/json"}}));expect(await(await call(defaults)).json()).toMatchObject({body:'{"broken":',bodyEncoding:"text"});});
 it.each([null,[],{}, {...defaults,other:1},{...defaults,service:"arbitrary"},{...defaults,method:"TRACE"},{...defaults,method:"get"},{...defaults,body:null},{...defaults,query:{api_key:"bad"}},{...defaults,query:{Authorization:"bad"}},{...defaults,query:{a:{nested:1}}},{...defaults,query:{a:[null]}},{...defaults,headers:{"X-Api-Key":"bad"}},{...defaults,headers:{"Authorization":"bad"}},{...defaults,headers:{"Cookie":"bad"}},{...defaults,headers:{"Host":"evil"}},{...defaults,headers:{"Connection":"keep-alive"}},{...defaults,headers:{"Content-Length":"0"}},{...defaults,headers:{"X-Test":"a\r\nb"}},{...defaults,headers:{"Forwarded":"host=evil"}},{...defaults,method:"POST",bodyEncoding:"text",body:1},{...defaults,method:"POST",bodyEncoding:"base64",body:"invalid==="},{...defaults,bodyEncoding:"json"}])("rejects invalid envelopes before transport: %j",async value=>{const r=await call(value);expect(r.status).toBe(400);expect(await r.json()).toMatchObject({error:{code:"AGENT_INVALID_REQUEST",requestId:expect.any(String)}});expect(upstream).not.toHaveBeenCalled();});
 it.each(["https://evil/x","//evil/x","/../secret","/a/../../secret","/%2e%2e/secret","/%252e%252e/secret","/a\\..\\secret","/%5csecret","/ok?apikey=bad","/ok#fragment","/%00","/%ZZ"])("rejects unsafe native path %s",async path=>{expect((await call({...defaults,path})).status).toBe(400);expect(upstream).not.toHaveBeenCalled();});
 it.each(["http://user:pass@host/prefix","file:///local","http://host/prefix?apiKey=x","http://host/prefix#frag","not a url"])("rejects malformed configured base URL %s",async baseUrl=>{settings.getDecryptedService.mockResolvedValue({apiKey:secret,baseUrl,username:"",password:""});expect((await call(defaults)).status).toBe(409);expect(upstream).not.toHaveBeenCalled();});
 it("preserves native session tokens and business usernames for chained API actions",async()=>{
  upstream.mockResolvedValue(new Response(JSON.stringify({username:"stored-user",token:"business-token",session_id:"session",request_token:"request"}),{headers:{"content-type":"application/json"}}));
  const r=await call({...defaults,query:{username:"stored-user",session_id:"session",request_token:"request",token:"business-token"}});expect(r.status).toBe(200);expect((await r.json()).body).toEqual({username:"stored-user",token:"business-token",session_id:"session",request_token:"request"});
 });
 it("accepts percent-encoded spaces in native path segments",async()=>{expect((await call({...defaults,path:"/native/My%20List"})).status).toBe(200);expect(upstream.mock.calls[0][0].pathname).toBe("/prefix/native/My%20List");});
 it.each(["HEAD","GET"])("does not apply representation Content-Length to empty %s/304 responses",async method=>{
  vi.stubEnv("RELAY_MAX_RESPONSE_BYTES","10");upstream.mockResolvedValue(new Response(null,{status:method==="HEAD"?200:304,headers:{"content-length":"100000000"}}));expect((await call({...defaults,method})).status).toBe(200);
 });
 it("returns 409 without an authenticated source",async()=>{settings.getDecryptedService.mockResolvedValue(null as never);expect((await call(defaults)).status).toBe(409);expect(upstream).not.toHaveBeenCalled();});
 it("never retries a failed mutation or leaks its transport error",async()=>{upstream.mockRejectedValue(new Error(`Request to http://host/?api_key=${secret} failed`));const r=await call({...defaults,method:"POST",body:{add:true}});expect(r.status).toBe(502);expect(JSON.stringify(await r.json())).not.toContain(secret);expect(upstream).toHaveBeenCalledTimes(1);});
 it("times out with no automatic mutation replay",async()=>{vi.stubEnv("RELAY_TIMEOUT_MS","20");upstream.mockImplementation((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener("abort",()=>reject(new Error(secret)))));const r=await call({...defaults,method:"POST",body:{}});expect(r.status).toBe(504);expect(upstream).toHaveBeenCalledTimes(1);});
 it.each([true,false])("bounds declared and streamed responses: declared=%s",async declared=>{vi.stubEnv("RELAY_MAX_RESPONSE_BYTES","10");upstream.mockResolvedValue(new Response("a".repeat(11),{headers:declared?{"content-length":"11"}:{}}));expect((await call(defaults)).status).toBe(413);});
 it("accepts nested relay JSON above 100 KiB while legacy routes retain their original 100 KiB limit",async()=>{
  const body={nested:{arbitrary:"a".repeat(150*1024)}};expect((await call({...defaults,method:"POST",body})).status).toBe(200);expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual(body);
  const r=await call(body,"legacy");expect(r.status).toBe(413);expect(await r.json()).toMatchObject({error:{requestId:expect.any(String)}});
 });
 it("rejects envelopes exceeding the default 10 MiB request budget before source access",async()=>{
  const r=await call({...defaults,method:"POST",body:"x".repeat(10*1024*1024)});expect(r.status).toBe(413);expect(await r.json()).toMatchObject({error:{code:"AGENT_INVALID_REQUEST",requestId:expect.any(String)}});expect(upstream).not.toHaveBeenCalled();
 });
 it("honors a configured request budget in the real route-local parser",async()=>{
  vi.stubEnv("RELAY_MAX_REQUEST_BYTES","1024");
  const module=await Test.createTestingModule({controllers:[AgentRelayController],providers:[AgentRelayPipe,AgentRelayService,{provide:SettingsService,useValue:settings}]}).compile();
  const limited=module.createNestApplication({logger:false});limited.setGlobalPrefix("api");configureAgentHttp(limited);await limited.listen(0,"127.0.0.1");
  try {const r=await clientFetch(`${await limited.getUrl()}/api/agent/relay`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...defaults,method:"POST",body:"x".repeat(1100)})});expect(r.status).toBe(413);expect(await r.json()).toMatchObject({error:{requestId:expect.any(String)}});expect(upstream).not.toHaveBeenCalled();}finally{await limited.close();}
 });
 it("bounds streamed responses even when Content-Length underreports bytes",async()=>{
  vi.stubEnv("RELAY_MAX_RESPONSE_BYTES","10");upstream.mockResolvedValue(new Response("x".repeat(11),{headers:{"content-length":"1"}}));expect((await call(defaults)).status).toBe(413);
 });
 it("retains primitive native query arrays and masks lower-case and double URL encoded keys",async()=>{
  const lower=encodeURIComponent(secret).replace(/%[A-F\d]{2}/g,value=>value.toLowerCase());upstream.mockResolvedValue(new Response(lower+" "+encodeURIComponent(encodeURIComponent(secret)),{headers:{"content-type":"text/plain"}}));
  expect((await(await call({...defaults,query:{values:["a b",1,true]}})).json()).body).toBe("[REDACTED] [REDACTED]");
  expect(upstream.mock.calls[0][0].searchParams.getAll("values")).toEqual(["a b","1","true"]);
 });
 it("rejects noncanonical base64 pad bits before transport",async()=>{expect((await call({...defaults,method:"POST",bodyEncoding:"base64",body:"AB=="})).status).toBe(400);expect(upstream).not.toHaveBeenCalled();});
 it("passes through Plex library commands without consulting recap selection",async()=>{
  expect((await call({...defaults,service:"plex",path:"/library/sections/999/all",query:{type:1}})).status).toBe(200);expect(upstream.mock.calls[0][0].pathname).toBe("/prefix/library/sections/999/all");
 });
 it("masks mixed-case percent escapes without treating the raw credential as case insensitive",async()=>{
  upstream.mockResolvedValue(new Response("?key=private%2fkey%2Bsecret%26value Raw=PRIVATE/key+secret&value",{headers:{"content-type":"text/plain"}}));
  const result=await(await call(defaults)).json();expect(result.body).toBe("?key=[REDACTED] Raw=PRIVATE/key+secret&value");expect(result.redacted).toBe(true);
 });
 it.each(["abc&#39;def","abc&#x27;def","abc&#X0027;def","abc&apos;def","&#97;bc'def"])("masks XML numeric/named representations of configured secrets: %s",async value=>{
  settings.getDecryptedService.mockResolvedValue({apiKey:secret,baseUrl:"http://host",username:"",password:"abc'def"});
  upstream.mockResolvedValue(new Response(`<item value="${value}" other="kept"/>`,{headers:{"content-type":"application/xml"}}));
  const result=await(await call(defaults)).json();expect(result.body).toBe('<item value="[REDACTED]" other="kept"/>');expect(result.redacted).toBe(true);
 });
 it.each(["Authorization: Bearer unknown-upstream-secret","Authorization: Basic unknown-upstream-secret","Cookie: session=upstream; other=another"])("masks complete unquoted authentication and cookie values: %s",async value=>{
  upstream.mockResolvedValue(new Response(value+"\nNormal: preserved",{headers:{"content-type":"text/plain"}}));const result=await(await call(defaults)).json();expect(result.body).not.toContain("unknown-upstream-secret");expect(result.body).not.toContain("upstream;");expect(result.body).not.toContain("another");expect(result.body).toContain("Normal: preserved");expect(result.redacted).toBe(true);
 });
 it.each([["123456",123456],["true",true],["false",false]])("masks native JSON scalar credential %s while preserving unrelated scalar types",async(apiKey,value)=>{
  settings.getDecryptedService.mockResolvedValue({apiKey:apiKey as string,baseUrl:"http://host",username:"",password:""});
  upstream.mockResolvedValue(new Response(JSON.stringify({reflected:value,number:123,boolean:!(value===true),null:null}),{headers:{"content-type":"application/json"}}));
  const result=await(await call(defaults)).json();expect(result.body.reflected).toBe("[REDACTED]");expect(result.body.number).toBe(123);expect(result.body.null).toBeNull();if(typeof value!=="boolean")expect(result.body.boolean).toBe(true);expect(result.redacted).toBe(true);
 });
 it("normalizes all stored service credentials, including a different service's Bearer prefix",async()=>{
  settings.getDecryptedService.mockImplementation(async service=>({apiKey:service==="tmdb"?"  Bearer another-service-key  ":secret,baseUrl:"http://host",username:"",password:""}));
  upstream.mockResolvedValue(new Response("another-service-key",{headers:{"content-type":"text/plain"}}));expect((await(await call(defaults)).json()).body).toBe("[REDACTED]");
 });
 it("decodes native text using its declared charset",async()=>{
  upstream.mockResolvedValue(new Response(new Uint8Array([99,97,102,233]),{headers:{"content-type":"text/plain; charset=iso-8859-1"}}));expect(await(await call(defaults)).json()).toMatchObject({body:"café",bodyEncoding:"text"});
 });
 it.each(["text/plain; charset=unknown-charset","text/plain; charset=utf-8","application/json"])("preserves undecodable %s bytes in base64",async contentType=>{
  upstream.mockResolvedValue(new Response(new Uint8Array([99,97,102,233]),{headers:{"content-type":contentType}}));expect(await(await call(defaults)).json()).toMatchObject({body:"Y2Fm6Q==",bodyEncoding:"base64"});
 });
 it("checks secrets in undecodable native text before returning base64",async()=>{
  upstream.mockResolvedValue(new Response(new TextEncoder().encode(secret),{headers:{"content-type":"text/plain; charset=unknown-charset"}}));expect((await call(defaults)).status).toBe(502);
 });
 it.each(["/native/100%25","/native/100%25/caf%C3%A9"])("preserves valid encoded literal percent path %s",async path=>{expect((await call({...defaults,path})).status).toBe(200);expect(upstream.mock.calls[0][0].pathname).toBe("/prefix"+path);});
 it.each(["/literal%25/%252e%252e/secret","/literal%25/%2e%2e%2fsecret","/literal%25/%252e%252e%252fsecret"])("rejects nested traversal beside a valid literal percent: %s",async path=>{expect((await call({...defaults,path})).status).toBe(400);expect(upstream).not.toHaveBeenCalled();});
 it("returns correlated malformed JSON errors",async()=>{const r=await clientFetch(`${base}/api/agent/relay`,{method:"POST",headers:{"content-type":"application/json"},body:"{"});expect(r.status).toBe(400);expect(await r.json()).toMatchObject({error:{code:"AGENT_INVALID_REQUEST",requestId:expect.any(String)}});});
});

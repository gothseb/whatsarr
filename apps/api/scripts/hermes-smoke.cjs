// Run after `pnpm --filter @whatsarr/api build`; never touches the user's database/session.
const assert = require("node:assert/strict");
const {mkdtemp,rm,readFile} = require("node:fs/promises");
const {tmpdir} = require("node:os");
const {join,resolve} = require("node:path");
require("reflect-metadata");

async function smoke() {
  const directory=await mkdtemp(join(tmpdir(),"whatsarr-hermes-production-"));
  let app;
  try {
    process.env.DATA_DIR=directory;
    process.env.DATABASE_URL=`file:${join(directory,"smoke.db")}`;
    process.env.AUTH_DISABLED="false";
    process.env.WEB_DIST_DIR=resolve(__dirname,"../../web/dist");
    const {Test}=require("@nestjs/testing");
    const {ValidationPipe}=require("@nestjs/common");
    const {of}=require("rxjs");
    const {AppModule}=require("../dist/app.module.js");
    const {configureAgentHttp}=require("../dist/modules/agent/agent-exception.filter.js");
    const {WHATSAPP_ADAPTER}=require("../dist/modules/whatsapp/whatsapp.types.js");
    const status={state:"disconnected",message:"Smoke test",lastChangedAt:new Date()};
    const adapter={status$:of(status),getStatus:()=>status,hasLocalSession:()=>false,initialize:async()=>status,disconnect:async()=>{},sendMessage:async()=>assert.fail("Smoke test must never send"),sendMedia:async()=>assert.fail("Smoke test must never send")};
    const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(WHATSAPP_ADAPTER).useValue(adapter).compile();
    app=module.createNestApplication({logger:false});
    app.setGlobalPrefix("api");configureAgentHttp(app);
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.listen(0,"127.0.0.1");
    const base=await app.getUrl();
    const schema=await (await fetch(`${base}/api/agent/openapi.json`)).json();
    assert.deepEqual(schema,JSON.parse(await readFile(resolve(__dirname,"../../../docs/hermes-agent.openapi.json"),"utf8")));
    for(const [path,code,statusCode] of [["radarr/movies","RADARR_NOT_CONFIGURED",409],["sonarr/series","SONARR_NOT_CONFIGURED",409],["seerr/requests","SEERR_NOT_CONFIGURED",409],["media/collections","PLEX_NOT_CONFIGURED",409],["media/catalogue","PLEX_NOT_CONFIGURED",409],["media/search?q=Alien","PLEX_NOT_CONFIGURED",409],["media/recent","PLEX_NOT_CONFIGURED",409],["watch-history","TAUTULLI_NOT_CONFIGURED",409],["messages/missing","AGENT_MESSAGE_NOT_FOUND",404],["tmdb?path=movie/popular","TMDB_NOT_CONFIGURED",409]]) {
      const response=await fetch(`${base}/api/agent/${path}`);
      assert.equal(response.status,statusCode,path);
      const body=await response.json();assert.equal(body.error.code,code);assert.ok(body.error.requestId);
    }
    const availabilityResponse=await fetch(`${base}/api/agent/media/availability?mediaType=movie&tmdbId=550`);
    assert.equal(availabilityResponse.status,200);
    const availability=await availabilityResponse.json();
    assert.equal(availability.arr.state,"unknown");assert.equal(availability.arr.error.code,"RADARR_NOT_CONFIGURED");
    assert.equal(availability.plex.state,"unknown");assert.equal(availability.plex.error.code,"PLEX_NOT_CONFIGURED");
    for(const [route,id] of [["radarr/movies",{tmdbId:550}],["sonarr/series",{tvdbId:42}]]) {
      const response=await fetch(`${base}/api/agent/${route}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...id,qualityProfileId:1,rootFolderId:1})});
      assert.equal(response.status,409);assert.ok((await response.json()).error.requestId);
    }
    const relay=await fetch(`${base}/api/agent/relay`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({service:"radarr",method:"GET",path:"/api/v3/movie"})});
    assert.equal(relay.status,409);assert.equal((await relay.json()).error.code,"RELAY_NOT_CONFIGURED");
    const largeRelay=await fetch(`${base}/api/agent/relay`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({service:"radarr",method:"POST",path:"/api/v3/movie",body:{arbitrary:{nested:"x".repeat(150*1024)}}})});
    assert.equal(largeRelay.status,409);assert.equal((await largeRelay.json()).error.code,"RELAY_NOT_CONFIGURED");
    const message=await fetch(`${base}/api/agent/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messageId:"smoke",text:"No send"})});
    assert.equal(message.status,409);assert.equal((await message.json()).error.code,"WHATSAPP_GROUP_NOT_SELECTED");
    const malformed=await fetch(`${base}/api/agent/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{"});assert.equal(malformed.status,400);assert.equal((await malformed.json()).error.code,"AGENT_INVALID_REQUEST");
    assert.equal((await fetch(`${base}/api/notifications/jobs`)).status,401);
    const catalogueResponse=await fetch(`${base}/api/agent/tmdb/catalogue`);
    assert.equal(catalogueResponse.status,200);
    const catalogue=await catalogueResponse.json();
    assert.equal(catalogue.routes.length,116);
    assert.ok(catalogue.routes.some(route=>route.path==="tv/{series_id}/recommendations"));
    console.log("Production smoke passed: real modules/DI, packaged OpenAPI, Hermes routes and TMDB catalogue, admin auth, temporary SQLite, no external send.");
  } finally { if(app) await app.close(); await rm(directory,{recursive:true,force:true}); }
}
smoke().catch(error=>{console.error(error);process.exitCode=1;});

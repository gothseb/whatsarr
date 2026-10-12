import { afterEach, describe, it, expect, vi } from "vitest";
import { PlexService } from "./plex.service";
const json=(data:unknown)=>new Response(JSON.stringify({MediaContainer:data}));
const config={getDecryptedService:vi.fn(async()=>({baseUrl:"http://p",apiKey:"secret"}))};
const query={offset:0,limit:2};
describe("Plex recent additions",()=>{
 afterEach(()=>vi.unstubAllGlobals());
 const fixture=()=>{
  const f=vi.fn(async(url:URL)=>{
   if(url.pathname.endsWith("/sections"))return json({Directory:[{key:1,type:"movie",title:"Films"},{key:2,type:"show",title:"Series"}]});
   const section=url.pathname.includes("/1/")?"1":"2", type=url.searchParams.get("type"), start=Number(url.searchParams.get("X-Plex-Container-Start"));
   if(section==="1")return start===0?json({size:2,totalSize:3,offset:0,Metadata:[{ratingKey:30,type:"movie",title:"New release",addedAt:100,originallyAvailableAt:"2026-10-10"},{ratingKey:20,type:"movie",title:"Old Alien",year:1979,addedAt:300,originallyAvailableAt:"1979-05-25"}]}):json({size:1,totalSize:3,offset:2,Metadata:[{ratingKey:10,type:"movie",title:"Equal timestamp",addedAt:300}]});
   if(type==="2")return json({size:1,totalSize:1,Metadata:[{ratingKey:20,type:"show",title:"Show",addedAt:200}]});
   return json({size:2,totalSize:2,Metadata:[{ratingKey:40,type:"episode",title:"Pilot",grandparentTitle:"Show",parentIndex:0,index:0,addedAt:400,originallyAvailableAt:"2024-02-20",token:"private",file:"/hidden"},{ratingKey:21,type:"episode",title:"Missing date",addedAt:"invalid",originallyAvailableAt:"2024-02-30"}]});
  });vi.stubGlobal("fetch",f);return f;
 };
 it("sorts globally by addedAt with complete ties and preserves older movies",async()=>{
  fixture();const service=new PlexService(config as never);const page=await service.recentMedia(query);
  expect(page.items.map(i=>i.title)).toEqual(["Pilot","Equal timestamp"]);expect(page.pagination.hasMore).toBe(true);
  const page2=await service.recentMedia({...query,offset:2});expect(page2.items[0]).toMatchObject({title:"Old Alien",year:1979,releaseDate:"1979-05-25",seriesTitle:null});
  expect(page.items[0]).toMatchObject({mediaType:"episode",seriesTitle:"Show",seasonNumber:0,episodeNumber:0,releaseDate:"2024-02-20"});expect(JSON.stringify(page)).not.toMatch(/private|hidden|token|file/);
 });
 it("filters episode and puts invalid dates last",async()=>{
  fixture();const result=await new PlexService(config as never).recentMedia({...query,mediaType:"episode"});expect(result.items.map(i=>i.mediaType)).toEqual(["episode","episode"]);expect(result.items[1]).toMatchObject({addedAt:null,releaseDate:null});expect(result.pagination.hasMore).toBe(false);
 });
 it("retains same ratingKey in different sections and handles offsets beyond end",async()=>{
  fixture();const service=new PlexService(config as never);const result=await service.recentMedia({...query,limit:100});expect(result.items.filter(i=>i.ratingKey==="20")).toHaveLength(2);
  expect(await service.recentMedia({...query,offset:100})).toEqual({items:[],pagination:{offset:100,limit:2,hasMore:false},source:"plex"});
 });
 it("preserves search shape and excludes episodes",async()=>{
  fixture();const result=await new PlexService(config as never).searchMedia({...query,q:"Show"});expect(result.items).toHaveLength(1);expect(result.items[0].mediaType).toBe("series");expect(result.items[0]).not.toHaveProperty("releaseDate");
 });
});

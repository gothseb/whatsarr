import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({construct:vi.fn(),fromUrl:vi.fn(async()=>({legacy:true}))}));
vi.mock("whatsapp-web.js",()=>({Client:class {},LocalAuth:class {},MessageMedia:class {
 constructor(...args:unknown[]){mocks.construct(...args);}
 static fromUrl=mocks.fromUrl;
}}));
import { WhatsAppWebJsAdapter } from "./whatsapp-web-js.adapter";
describe("WhatsApp controlled media boundary",()=>{
 beforeEach(()=>vi.clearAllMocks());
 const setup=()=>{const driver=new WhatsAppWebJsAdapter();const client={sendMessage:vi.fn(async()=>{})};(driver as any).client=client;(driver as any).status.state="connected";return {driver,client};};
 it("constructs media once from verified bytes and sends exact caption",async()=>{
  const {driver,client}=setup();const data=Buffer.from([1,2,3]);await driver.sendMedia("group"," {{title}}\n ",{mimetype:"image/png",data,filename:"hermes-photo.png",filesize:3});
  expect(mocks.construct).toHaveBeenCalledWith("image/png",data.toString("base64"),"hermes-photo.png",3);
  expect(client.sendMessage).toHaveBeenCalledWith("group",expect.any(Object),{caption:" {{title}}\n "});expect(client.sendMessage).toHaveBeenCalledOnce();expect(mocks.fromUrl).not.toHaveBeenCalled();
 });
 it("preserves legacy URL media sending",async()=>{
  const {driver,client}=setup();await driver.sendMessage("group","legacy","http://poster");expect(mocks.fromUrl).toHaveBeenCalledWith("http://poster");expect(client.sendMessage).toHaveBeenCalledWith("group",{legacy:true},{caption:"legacy"});
 });
 it("refuses media while disconnected",async()=>{await expect(new WhatsAppWebJsAdapter().sendMedia("group","x",{mimetype:"image/png",data:Buffer.alloc(0),filename:"x",filesize:0})).rejects.toThrow("connexion WhatsApp");});
});

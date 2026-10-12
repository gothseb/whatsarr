import { describe, expect, it } from "vitest";
import { AgentMessagePipe } from "./agent.dto";

describe("Hermes message contract", () => {
  const pipe = new AgentMessagePipe();
  it("preserves exact text and identity", () => {
    expect(pipe.transform({ messageId: " A ", text: " {{title}}\n " })).toEqual({ messageId: " A ", text: " {{title}}\n " });
  });
  it.each([null, [], false, 12, "text", {}, {messageId:" ",text:"ok"}, {messageId:"a",text:" "}, {messageId:"a",text:"ok",groupId:"x"}, {messageId:"a",text:null}, {messageId:"a",text:"😀".repeat(2001)}])("rejects invalid body %j", (body) => {
    expect(() => pipe.transform(body)).toThrow();
  });
  it.each([null, "", 12, "data:image/png,x", "/local", "http://u:p@h/i"])("rejects invalid image URL %s",imageUrl=>{expect(()=>pipe.transform({messageId:"a",text:"ok",imageUrl})).toThrow();});
  it("enforces caption length preserving LAN URL",()=>{
    expect(pipe.transform({messageId:"a",text:"😀".repeat(500),imageUrl:"http://hermes/photo"})).toMatchObject({imageUrl:"http://hermes/photo"});
    expect(()=>pipe.transform({messageId:"a",text:"a".repeat(1001),imageUrl:"http://hermes/photo"})).toThrow();
  });
  it("counts UTF16 units", () => {
    expect(pipe.transform({messageId:"a",text:"😀".repeat(2000)}).text.length).toBe(4000);
    expect(()=>pipe.transform({messageId:"😀".repeat(65),text:"ok"})).toThrow();
  });
});

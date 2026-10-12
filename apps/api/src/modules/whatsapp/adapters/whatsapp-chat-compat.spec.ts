import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Exercise the installed dependency's injected function, not a duplicate implementation.
const dependencyRequire = createRequire(`${process.cwd()}/package.json`);
const source = readFileSync(dependencyRequire.resolve("whatsapp-web.js/src/util/Injected/Utils.js"), "utf8");
const start = source.indexOf("window.WWebJS.getChatModel =");
const end = source.indexOf("window.WWebJS.getContactModel =", start);

function setup() {
  const message = { text: "last message" };
  const get = vi.fn((id: unknown) => {
    if (!id) throw new Error("IndexedDB cannot get undefined");
    return message;
  });
  const createWid = vi.fn((id: unknown) => {
    if (!id) throw new Error("Invalid group identifier");
    return id;
  });
  const update = vi.fn(async () => {});
  const modules: Record<string, unknown> = {
    WAWebCollections: { Msg: { get, getMessagesById: vi.fn() }, GroupMetadata: { update } },
    WAWebWidFactory: { createWid },
    WAWebLidMigrationUtils: { toPn: (id: unknown) => id }
  };
  const window = { WWebJS: { getMessageModel: (value: unknown) => value } as any, require: (name: string) => modules[name] };
  runInNewContext(source.slice(start, end), { window });
  return { window, get, createWid, update };
}

describe("WhatsApp Web serialized identifier compatibility", () => {
  for (const key of ["_serialized", "$1"]) {
    it(`reads the last message with ${key}`, async () => {
      const { window, get } = setup();
      const result = await window.WWebJS.getChatModel({ serialize: () => ({ msgs: [1] }), lastReceivedKey: { [key]: "message-key" } });
      expect(get).toHaveBeenCalledWith("message-key");
      expect(result.lastMessage).toEqual({ text: "last message" });
    });
    it(`refreshes group metadata with ${key}`, async () => {
      const { window, createWid, update } = setup();
      const result = await window.WWebJS.getChatModel({ serialize: () => ({}), id: { [key]: "group@g.us" }, groupMetadata: { serialize: () => ({ participants: [] }), announce: false } });
      expect(createWid).toHaveBeenCalledWith("group@g.us");
      expect(update).toHaveBeenCalledWith("group@g.us");
      expect(result.isGroup).toBe(true);
    });
  }
  it("prefers the original identifier when both names exist", async () => {
    const { window, get } = setup();
    await window.WWebJS.getChatModel({ serialize: () => ({ msgs: [1] }), lastReceivedKey: { _serialized: "old", $1: "new" } });
    expect(get).toHaveBeenCalledWith("old");
  });
  it("skips the last-message lookup when its identifier is absent", async () => {
    const { window, get } = setup();
    const result = await window.WWebJS.getChatModel({ serialize: () => ({ msgs: [1] }), lastReceivedKey: {} });
    expect(get).not.toHaveBeenCalled();
    expect(result.lastMessage).toBeNull();
  });
});

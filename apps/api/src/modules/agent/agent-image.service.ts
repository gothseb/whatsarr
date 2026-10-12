import { Injectable } from "@nestjs/common";
import type { WhatsAppMedia } from "../whatsapp/whatsapp.types";

const MAX_BYTES = 10 * 1024 * 1024;
export function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

@Injectable()
export class AgentImageService {
  async download(source: string): Promise<WhatsAppMedia> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let response: Response | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const abortReader = () => { void reader?.cancel().catch(() => undefined); };
    controller.signal.addEventListener("abort", abortReader);
    const fail = (code: string): never => { throw new Error(code); };
    try {
      if (!isImageUrl(source)) fail("AGENT_IMAGE_INVALID");
      let url = new URL(source);
      for (let hop = 0; hop <= 5; hop++) {
        response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { Accept: "image/jpeg,image/png" } });
        if (![301,302,303,307,308].includes(response.status)) break;
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || hop === 5) fail("AGENT_IMAGE_REDIRECT_INVALID");
        let next: string;
        try { next = new URL(location!, url).href; } catch { fail("AGENT_IMAGE_REDIRECT_INVALID"); }
        if (!isImageUrl(next!)) fail("AGENT_IMAGE_REDIRECT_INVALID");
        url = new URL(next!);
      }
      if (!response?.ok) fail("AGENT_IMAGE_UNREACHABLE");
      const mimetype = response!.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (!mimetype || !["image/jpeg", "image/png"].includes(mimetype)) fail("AGENT_IMAGE_INVALID");
      if (Number(response!.headers.get("content-length")) > MAX_BYTES) fail("AGENT_IMAGE_TOO_LARGE");
      if (!response!.body) fail("AGENT_IMAGE_INVALID");
      reader = response!.body!.getReader();
      const chunks: Buffer[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        controller.signal.throwIfAborted();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) fail("AGENT_IMAGE_TOO_LARGE");
        chunks.push(Buffer.from(value));
      }
      const data = Buffer.concat(chunks, size);
      const png = data.length >= 8 && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255;
      if (!(mimetype === "image/png" ? png : jpeg)) fail("AGENT_IMAGE_INVALID");
      return { mimetype: mimetype!, data, filesize: size, filename: mimetype === "image/png" ? "hermes-photo.png" : "hermes-photo.jpg" };
    } catch (error) {
      if (controller.signal.aborted) fail("AGENT_IMAGE_TIMEOUT");
      if (error instanceof Error && /^AGENT_IMAGE_/.test(error.message)) throw error;
      fail("AGENT_IMAGE_UNREACHABLE");
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", abortReader);
      controller.abort();
      if (!reader) await response?.body?.cancel().catch(() => undefined);
      await reader?.cancel().catch(() => undefined);
      reader?.releaseLock();
    }
    throw new Error("AGENT_IMAGE_UNREACHABLE");
  }
}

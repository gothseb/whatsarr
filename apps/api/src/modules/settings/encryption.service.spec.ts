import { describe, expect, it } from "vitest";
import { EncryptionService } from "./encryption.service";

describe("EncryptionService", () => {
  it("round-trips secrets without storing clear text", () => {
    process.env.APP_ENCRYPTION_KEY = "test-secret-key-with-at-least-32-characters";
    const service = new EncryptionService();

    const encrypted = service.encrypt("plex-token");

    expect(encrypted).not.toContain("plex-token");
    expect(service.decrypt(encrypted)).toBe("plex-token");
  });
});

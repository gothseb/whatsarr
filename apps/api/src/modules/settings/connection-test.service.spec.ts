import { describe, expect, it, vi } from "vitest";
import { ConnectionTestService } from "./connection-test.service";

describe("ConnectionTestService", () => {
  it("keeps unconfigured services independent", async () => {
    const service = new ConnectionTestService({
      getDecryptedService: vi.fn().mockResolvedValue(null)
    } as never);

    await expect(service.test("tmdb")).resolves.toMatchObject({
      status: "not_configured"
    });
  });

  it("normalizes authentication failures without exposing secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );
    const service = new ConnectionTestService({
      getDecryptedService: vi.fn().mockResolvedValue({
        serviceKey: "plex",
        baseUrl: "http://plex.local",
        apiKey: "secret-token"
      })
    } as never);

    await expect(service.test("plex")).resolves.toMatchObject({
      status: "authentication_error"
    });
    await expect(service.test("plex")).resolves.not.toMatchObject({
      message: expect.stringContaining("secret-token")
    });
  });
});

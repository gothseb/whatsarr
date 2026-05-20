import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  afterEach(() => {
    delete process.env.COOKIE_SECURE;
  });

  it("creates and verifies signed HTTP session tokens", () => {
    const service = new AuthService(mockPrisma() as never);

    const token = service.createSession();

    expect(service.verifySession(token)).toBe(true);
    expect(service.verifySession(`${token}tampered`)).toBe(false);
  });

  it("does not mark session cookies secure unless explicitly enabled", () => {
    const service = new AuthService(mockPrisma() as never);

    expect(service.getCookieOptions().secure).toBe(false);

    process.env.COOKIE_SECURE = "true";

    expect(service.getCookieOptions().secure).toBe(true);
  });
});

function mockPrisma() {
  return {
    adminCredential: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn()
    }
  };
}

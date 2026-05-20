import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  afterEach(() => {
    delete process.env.AUTH_DISABLED;
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

  it("disables admin setup by default unless explicitly required", async () => {
    const prisma = mockPrisma();
    const service = new AuthService(prisma as never);

    expect(service.isAuthDisabled()).toBe(true);
    await expect(service.isSetupComplete()).resolves.toBe(true);
    expect(prisma.adminCredential.count).not.toHaveBeenCalled();

    process.env.AUTH_DISABLED = "false";
    prisma.adminCredential.count.mockResolvedValue(0);

    expect(service.isAuthDisabled()).toBe(false);
    await expect(service.isSetupComplete()).resolves.toBe(false);
    expect(prisma.adminCredential.count).toHaveBeenCalledOnce();
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

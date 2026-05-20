import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("creates and verifies signed HTTP session tokens", () => {
    const service = new AuthService(mockPrisma() as never);

    const token = service.createSession();

    expect(service.verifySession(token)).toBe(true);
    expect(service.verifySession(`${token}tampered`)).toBe(false);
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

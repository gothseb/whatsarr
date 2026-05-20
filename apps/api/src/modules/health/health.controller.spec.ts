import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns a JSON health payload", () => {
    const payload = new HealthController().getHealth();

    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("whatsarr");
    expect(payload.timestamp).toEqual(expect.any(String));
  });
});

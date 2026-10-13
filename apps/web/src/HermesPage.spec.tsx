import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HermesDocumentation, HermesPage, hermesAddresses } from "./HermesPage";

describe("Hermes connection and documentation", () => {
  it("uses the actual origin and port for each copyable address", () => {
    const origin = "http://192.168.1.42:3001";
    expect(hermesAddresses(origin)).toEqual({ webhook: `${origin}/api/agent/messages`, documentation: `${origin}/hermes-doc`, openapi: `${origin}/api/agent/openapi.json` });
    const html = renderToStaticMarkup(<HermesPage origin={origin} />);
    expect(html).toContain(`${origin}/hermes-doc`);
    expect(html).toMatch(/readonly=""/i);
    expect(html).toContain("Copier");
    expect(html).toContain(`${origin}/api/agent/tmdb/catalogue`);
  });
  it("documents all six routes with adapted examples and a valid OpenAPI link", () => {
    const html = renderToStaticMarkup(<HermesDocumentation origin="http://localhost:3001" />);
    for (const route of ["messages", "messages/JOB_ID", "media/search", "media/recent", "watch-history", "openapi.json", "tmdb?path=", "tmdb/catalogue"]) expect(html).toContain(`/api/agent/${route}`);
    expect(html).toContain("http://localhost:3001/api/agent/messages");
    expect(html).not.toContain("localhost:3000");
    expect(html).toContain('href="/api/agent/openapi.json"');
    expect(html).toContain("AGENT_MESSAGE_ID_CONFLICT");
    expect(html).toContain("sans clé Hermes ni cookie");
  });
});

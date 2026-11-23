import { afterEach, describe, expect, it, vi } from "vitest";
import { factoryFetch } from "#/factory/api/client";

describe("factoryFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  const capture = () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        seen.push({ url, headers: init.headers as Record<string, string> });
        return new Response("{}", { status: 200 });
      }),
    );
    return seen;
  };

  it("declares JSON only with a body (Fastify rejects an empty JSON body)", async () => {
    const seen = capture();
    await factoryFetch("/projects/p/workflows/w/run", { method: "POST" });
    await factoryFetch("/x", { method: "DELETE" });
    await factoryFetch("/x", { method: "PUT", body: { a: 1 } });
    await factoryFetch("/x");
    expect(seen[0]!.headers).toEqual({
      Accept: "application/json",
      "X-Factory-Request": "1",
    });
    expect(seen[1]!.headers["Content-Type"]).toBeUndefined();
    expect(seen[2]!.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Factory-Request": "1",
    });
    expect(seen[3]!.headers).toEqual({ Accept: "application/json" });
  });
});

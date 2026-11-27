import { describe, expect, it } from "vitest";
import { previewTicketKey, previewUrls } from "#/factory/preview-panel";

describe("preview URLs", () => {
  it("points at the ticket's stack, and the project index lists them all", () => {
    expect(previewUrls("/preview/autoriz/", { id: 3, issue: 792 })).toEqual({
      url: "/preview/autoriz/792/",
      index: "/preview/autoriz/",
      sw: "/preview/autoriz/~sw.js",
      ports: "/preview/autoriz/~ports/792",
    });
    expect(previewUrls("/preview/autoriz", { id: 43, issue: null })).toEqual({
      url: "/preview/autoriz/sched-43/",
      index: "/preview/autoriz/",
      sw: "/preview/autoriz/~sw.js",
      ports: "/preview/autoriz/~ports/sched-43",
    });
    expect(previewTicketKey({ id: 9, issue: 12 })).toBe("12");
  });
});

describe("preview frame", () => {
  it("builds the frame address of the app or another port", async () => {
    const { previewSrc } = await import("#/factory/preview-frame");
    expect(previewSrc("/preview/autoriz/792/", null, "/projects/7?a=1")).toBe(
      "/preview/autoriz/792/projects/7?a=1",
    );
    expect(previewSrc("/preview/autoriz/792/", 8025, "/")).toBe(
      "/preview/autoriz/792/~8025/",
    );
  });
});

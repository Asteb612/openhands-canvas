import { describe, expect, it } from "vitest";
import { previewTicketKey, previewUrls } from "#/factory/preview-panel";

describe("preview URLs", () => {
  it("points at the ticket's stack, and the project index lists them all", () => {
    expect(previewUrls("/preview/autoriz/", { id: 3, issue: 792 })).toEqual({
      url: "/preview/autoriz/792/",
      index: "/preview/autoriz/",
    });
    expect(previewUrls("/preview/autoriz", { id: 43, issue: null })).toEqual({
      url: "/preview/autoriz/sched-43/",
      index: "/preview/autoriz/",
    });
    expect(previewTicketKey({ id: 9, issue: 12 })).toBe("12");
  });
});

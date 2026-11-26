import { describe, expect, it } from "vitest";
import { previewHref } from "#/factory/preview-panel";

describe("previewHref", () => {
  it("joins the typed path to the preview origin and never leaves it", () => {
    const base = "https://preview-autoriz.example.fr";
    expect(previewHref(base, "/projects/12?tab=activity")).toBe(
      "https://preview-autoriz.example.fr/projects/12?tab=activity",
    );
    expect(previewHref(base, "")).toBe("https://preview-autoriz.example.fr/");
    expect(previewHref(base, "login")).toBe(
      "https://preview-autoriz.example.fr/login",
    );
    expect(previewHref(base, "https://evil.example/x")).toBe(
      "https://preview-autoriz.example.fr/",
    );
    expect(previewHref(base, "//evil.example/x")).toBe(
      "https://preview-autoriz.example.fr/",
    );
  });
});

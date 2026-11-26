import { describe, expect, it } from "vitest";
import { parseDemoReadme } from "#/factory/demo-gallery";

describe("parseDemoReadme", () => {
  it("lists the README's relative images and videos, in order, once", () => {
    const md = [
      "# Démo",
      "![Fil vide, critère 1](01-fil.png)",
      "![](./02-message.png)",
      "![Parcours](parcours.gif) et ![vidéo](parcours.webm)",
      "![doublon](01-fil.png)",
    ].join("\n");
    expect(parseDemoReadme(md)).toEqual([
      { file: "01-fil.png", caption: "Fil vide, critère 1", mime: "image/png" },
      { file: "02-message.png", caption: "", mime: "image/png" },
      { file: "parcours.gif", caption: "Parcours", mime: "image/gif" },
      { file: "parcours.webm", caption: "vidéo", mime: "video/webm" },
    ]);
  });

  it("ignores remote, absolute, parent and unknown files", () => {
    const md =
      "![a](https://x/y.png) ![b](/etc/x.png) ![c](../x.png) ![d](notes.txt)";
    expect(parseDemoReadme(md)).toEqual([]);
  });
});

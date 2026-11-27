import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FactoryPreviewFrame } from "#/factory/preview-frame";
import { previewUrls } from "#/factory/preview-panel";

describe("FactoryPreviewFrame", () => {
  const register = vi.fn(() => Promise.resolve({}));
  beforeEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register, ready: Promise.resolve({}) },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          app: 8080,
          ports: [{ port: 8025, service: "mailhog" }],
        }),
      })),
    );
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("registers the worker, then shows the app in a sandboxed preview frame", async () => {
    const preview = previewUrls("/preview/autoriz/", { id: 3, issue: 792 });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FactoryPreviewFrame preview={preview} />
      </QueryClientProvider>,
    );
    const frame = await screen.findByTestId("factory-preview-frame");
    expect(register).toHaveBeenCalledWith("/preview/autoriz/~sw.js", {
      scope: "/",
    });
    expect(frame).toHaveAttribute("src", "/preview/autoriz/792/");
    expect(frame).toHaveAttribute("data-factory-preview");
    expect(frame.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");

    // The frame reports its address: shown and kept, the frame is not reloaded.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "factory-preview:path", path: "/projects/7" },
          source: (frame as HTMLIFrameElement).contentWindow,
        }),
      );
    });
    expect(screen.getByTestId("factory-preview-path")).toHaveValue(
      "/projects/7",
    );
    expect(
      localStorage.getItem("factory.preview.path./preview/autoriz/792/"),
    ).toBe("/projects/7");
    expect(screen.getByTestId("factory-preview-frame")).toHaveAttribute(
      "src",
      "/preview/autoriz/792/",
    );

    // Another port of the stack.
    const service = await screen.findByTestId("factory-preview-service");
    await userEvent.selectOptions(service, "8025");
    await waitFor(() =>
      expect(screen.getByTestId("factory-preview-frame")).toHaveAttribute(
        "src",
        "/preview/autoriz/792/~8025/",
      ),
    );
  });
});

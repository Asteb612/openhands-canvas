import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiffChangeList } from "#/components/features/diff-viewer/diff-change-list";

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    // Skip exit animations so open/close assertions are synchronous.
    useReducedMotion: () => true,
  };
});

vi.mock("#/hooks/query/use-unified-git-diff", () => ({
  useUnifiedGitDiff: () => ({
    data: { original: "a", modified: "b" },
    isLoading: false,
    isSuccess: true,
    isRefetching: false,
  }),
}));

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: () => <div data-testid="file-diff-viewer" />,
  Editor: () => <div data-testid="file-single-viewer" />,
}));

describe("DiffChangeList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only one file expanded at a time", async () => {
    const user = userEvent.setup();
    render(
      <DiffChangeList
        changes={[
          { path: "a.ts", status: "M" },
          { path: "b.ts", status: "A" },
        ]}
      />,
    );

    const [firstToggle, secondToggle] = screen.getAllByTestId("collapse");

    await user.click(firstToggle);
    expect(
      screen
        .getAllByTestId("file-diff-viewer-outer")[0]
        .querySelector('[data-testid="file-diff-viewer"]'),
    ).toBeTruthy();
    expect(
      screen
        .getAllByTestId("file-diff-viewer-outer")[1]
        .querySelector('[data-testid="file-diff-viewer"]'),
    ).toBeNull();

    await user.click(secondToggle);
    expect(
      screen
        .getAllByTestId("file-diff-viewer-outer")[0]
        .querySelector('[data-testid="file-diff-viewer"]'),
    ).toBeNull();
    expect(
      screen
        .getAllByTestId("file-diff-viewer-outer")[1]
        .querySelector('[data-testid="file-diff-viewer"]'),
    ).toBeTruthy();
  });

  it("collapses the open file when its header is clicked again", async () => {
    const user = userEvent.setup();
    render(<DiffChangeList changes={[{ path: "a.ts", status: "M" }]} />);

    await user.click(screen.getByTestId("collapse"));
    expect(screen.getByTestId("file-diff-viewer")).toBeInTheDocument();

    await user.click(screen.getByTestId("collapse"));
    expect(screen.queryByTestId("file-diff-viewer")).not.toBeInTheDocument();
  });
});

describe("buildDiffTree (factory: tree view)", () => {
  it("groups by folder, compacts single-child chains, sorts folders and files", async () => {
    const { buildDiffTree } =
      await import("#/components/features/diff-viewer/diff-change-list");
    const tree = buildDiffTree([
      { path: "backend/src/features/activity/b.ts", status: "M" },
      { path: "backend/src/features/activity/a.ts", status: "A" },
      { path: "backend/src/features/authz/c.ts", status: "M" },
      { path: "README.md", status: "M" },
      { path: "R old/x.ts frontend/y.ts", status: "R" },
    ]);
    expect(tree.count).toBe(5);
    expect(tree.files.map((f) => f.name)).toEqual(["README.md"]);
    expect(tree.folders.map((f) => [f.name, f.count])).toEqual([
      ["backend/src/features", 3],
      ["frontend", 1],
    ]);
    const features = tree.folders[0];
    expect(features.folders.map((f) => f.name)).toEqual(["activity", "authz"]);
    expect(features.folders[0].files.map((f) => f.name)).toEqual([
      "a.ts",
      "b.ts",
    ]);
    expect(tree.folders[1].files[0].name).toBe("y.ts");
  });
});

describe("isFactoryInternal (factory: hidden .factory files)", () => {
  it("matches .factory at any depth, and renames into it", async () => {
    const { isFactoryInternal } =
      await import("#/components/features/diff-viewer/diff-change-list");
    expect(
      isFactoryInternal({ path: ".factory/ticket.json", status: "A" }),
    ).toBe(true);
    expect(
      isFactoryInternal({ path: "repo/.factory/COMMANDS.md", status: "M" }),
    ).toBe(true);
    expect(isFactoryInternal({ path: "src/factory/x.ts", status: "M" })).toBe(
      false,
    );
    expect(
      isFactoryInternal({ path: "R a.ts .factory/a.ts", status: "R" }),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { isTurned, orthoHalfHeight, perspectiveDistance, sanitizeViews, VIEW_LIMIT, withView, type SavedView } from "./snapshotViews";

const view = (name: string, extra: Partial<SavedView> = {}): SavedView => ({ name, position: [1, 2, 3], target: [0, 0, 0], zoom: 1, ortho: false, fov: 35, pivot: [0, 0, 0, 1], ...extra });

describe("GB Snapshot's lens", () => {
  it("keeps the model's size when the lens swaps: the flat view is as tall as the lens saw at the target", () => {
    expect(orthoHalfHeight(10, 90)).toBeCloseTo(10);
    for (const fov of [15, 35, 75]) expect(perspectiveDistance(orthoHalfHeight(7, fov), fov)).toBeCloseTo(7);
  });
});

describe("saved views", () => {
  it("reads only well-formed views, trims names and keeps no more than the limit", () => {
    expect(sanitizeViews(null)).toEqual([]);
    expect(sanitizeViews([view("  Front  "), { name: "bad", position: [1, 2] }, { ...view(""), name: " " }, { ...view("Z"), zoom: -1, fov: 900 }]))
      .toEqual([view("Front"), view("Z")]);
    expect(sanitizeViews(Array.from({ length: 40 }, (_, i) => view(`v${i}`)))).toHaveLength(VIEW_LIMIT);
  });
  it("replaces a view of the same name in its place, and knows a turned one", () => {
    const list = withView([view("A"), view("B")], view("A", { ortho: true }));
    expect(list.map((item) => [item.name, item.ortho])).toEqual([["A", true], ["B", false]]);
    expect(withView(list, view("C")).map((item) => item.name)).toEqual(["A", "B", "C"]);
    expect(isTurned(view("A"))).toBe(false);
    expect(isTurned(view("A", { pivot: [0, 0.7071, 0, 0.7071] }))).toBe(true);
  });
});

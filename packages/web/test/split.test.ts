import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clampRatio, ratioFromPointer, syncTarget, shouldRestore, createSyncGate, worthWriting, MIN_RATIO, MAX_RATIO } from "../src/split.ts";

describe("clampRatio", () => {
  it("keeps a sensible ratio untouched", () => {
    expect(clampRatio(0.5)).toBe(0.5);
  });

  it("holds both panes usable at the extremes", () => {
    expect(clampRatio(0)).toBe(MIN_RATIO);
    expect(clampRatio(1)).toBe(MAX_RATIO);
    expect(clampRatio(-4)).toBe(MIN_RATIO);
    expect(clampRatio(9)).toBe(MAX_RATIO);
  });

  it("falls back to an even split for values that are not numbers", () => {
    expect(clampRatio(NaN)).toBe(0.5);
    expect(clampRatio(Infinity)).toBe(MAX_RATIO);
  });
});

describe("ratioFromPointer", () => {
  const rect = { left: 100, width: 800 };

  it("maps a pointer position to a fraction of the container", () => {
    expect(ratioFromPointer(500, rect)).toBeCloseTo(0.5);
    expect(ratioFromPointer(300, rect)).toBeCloseTo(0.25);
  });

  it("clamps a drag past either edge", () => {
    expect(ratioFromPointer(0, rect)).toBe(MIN_RATIO);
    expect(ratioFromPointer(5000, rect)).toBe(MAX_RATIO);
  });

  it("survives a zero-width container without dividing by zero", () => {
    expect(ratioFromPointer(100, { left: 100, width: 0 })).toBe(0.5);
  });
});

describe("syncTarget", () => {
  it("maps a scroll fraction onto the other pane", () => {
    const source = { scrollTop: 250, scrollHeight: 1000, clientHeight: 500 };
    const target = { scrollTop: 0, scrollHeight: 3000, clientHeight: 500 };
    // source is halfway through its 500px of travel, so the target should be too
    expect(syncTarget(source, target)).toBe(1250);
  });

  it("pins the ends exactly, so bottom always means bottom", () => {
    const source = { scrollTop: 500, scrollHeight: 1000, clientHeight: 500 };
    const target = { scrollTop: 0, scrollHeight: 3000, clientHeight: 500 };
    expect(syncTarget(source, target)).toBe(2500);
    expect(syncTarget({ ...source, scrollTop: 0 }, target)).toBe(0);
  });

  it("stays at the top when either pane has nothing to scroll", () => {
    const short = { scrollTop: 0, scrollHeight: 400, clientHeight: 500 };
    const tall = { scrollTop: 100, scrollHeight: 2000, clientHeight: 500 };
    expect(syncTarget(short, tall)).toBe(0);
    expect(syncTarget(tall, short)).toBe(0);
  });
});

describe("shouldRestore", () => {
  it("restores a position the browser clamped away", () => {
    // wanted 900, the shrunken document only allowed 400, nothing moved since
    expect(shouldRestore(900, 400, 400)).toBe(true);
  });

  it("leaves the reader alone once they have scrolled themselves", () => {
    expect(shouldRestore(900, 400, 220)).toBe(false);
  });

  it("does nothing when the position was never clamped", () => {
    expect(shouldRestore(900, 900, 900)).toBe(false);
  });
});

// A scroll sync that lets both panes drive at once feeds back on itself: the
// panes have different travel, so mapping A onto B and B back onto A does not
// return where A started, and the rounding error accumulates in one direction.
// That is the "slowly scrolls up on its own" bug. One pane owns a gesture.
describe("createSyncGate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("lets whichever pane moves first own the gesture", () => {
    const gate = createSyncGate(150);
    expect(gate.claim("editor")).toBe(true);
  });

  it("refuses the other pane while the owner is still scrolling", () => {
    const gate = createSyncGate(150);
    gate.claim("editor");
    expect(gate.claim("preview")).toBe(false);
    expect(gate.claim("preview")).toBe(false);
  });

  it("keeps the owner across a continuous gesture, however long", () => {
    const gate = createSyncGate(150);
    for (let i = 0; i < 40; i++) {
      expect(gate.claim("editor")).toBe(true);
      vi.advanceTimersByTime(30); // momentum keeps firing inside the settle window
      expect(gate.claim("preview")).toBe(false);
    }
  });

  it("hands over once scrolling has actually stopped", () => {
    const gate = createSyncGate(150);
    gate.claim("editor");
    vi.advanceTimersByTime(151);
    expect(gate.claim("preview")).toBe(true);
  });

  it("does not let the non-owner extend its own turn", () => {
    const gate = createSyncGate(150);
    gate.claim("editor");
    vi.advanceTimersByTime(100);
    gate.claim("preview"); // refused, and must not refresh the timer
    vi.advanceTimersByTime(51);
    expect(gate.claim("preview")).toBe(true);
  });
});

describe("worthWriting", () => {
  it("skips a sub-pixel correction, which is where creep comes from", () => {
    expect(worthWriting(400, 400.4)).toBe(false);
    expect(worthWriting(400, 399.7)).toBe(false);
  });

  it("still writes a real movement", () => {
    expect(worthWriting(400, 402)).toBe(true);
    expect(worthWriting(400, 0)).toBe(true);
  });
});

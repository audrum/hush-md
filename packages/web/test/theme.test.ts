// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { initTheme, toggleTheme, storedTheme, applyTheme, currentTheme } from "../src/theme.ts";

// jsdom in this setup runs on an opaque origin with no localStorage; the code
// under test only needs the Storage contract, so back it with a Map.
const backing = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, String(v)),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
  },
});

beforeEach(() => {
  backing.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme", () => {
  it("initTheme applies a stored choice over the system preference", () => {
    localStorage.setItem("hush-theme", "dark");
    initTheme();
    expect(currentTheme()).toBe("dark");
  });

  it("initTheme falls back to system preference when nothing is stored (jsdom = light)", () => {
    initTheme();
    expect(currentTheme()).toBe("light");
  });

  it("storedTheme rejects garbage values", () => {
    localStorage.setItem("hush-theme", "blue");
    expect(storedTheme()).toBeNull();
  });

  it("toggleTheme flips the attribute and persists", () => {
    applyTheme("light");
    expect(toggleTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("hush-theme")).toBe("dark");
    expect(toggleTheme()).toBe("light");
    expect(localStorage.getItem("hush-theme")).toBe("light");
  });
});

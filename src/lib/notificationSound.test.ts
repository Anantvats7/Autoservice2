/**
 * Tests for notification sound preference logic.
 * AudioContext is not available in jsdom, so we focus on the
 * preference-storage helpers and the safe-noop behaviour of playTing.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { isSoundEnabled, setSoundEnabled, playTing } from "./notificationSound";

describe("notificationSound preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to enabled when nothing is stored", () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it("persists the disabled preference", () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
  });

  it("re-enabling toggles the flag back to true", () => {
    setSoundEnabled(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it("uses the 'autoserve.notifSound' storage key", () => {
    setSoundEnabled(false);
    expect(window.localStorage.getItem("autoserve.notifSound")).toBe("off");
    setSoundEnabled(true);
    expect(window.localStorage.getItem("autoserve.notifSound")).toBe("on");
  });
});

describe("playTing", () => {
  it("does not throw when AudioContext is unavailable (jsdom)", () => {
    // jsdom has no AudioContext — playTing must no-op silently.
    expect(() => playTing()).not.toThrow();
  });

  it("does not throw with a custom volume value", () => {
    expect(() => playTing(0.5)).not.toThrow();
    expect(() => playTing(0)).not.toThrow();
  });
});

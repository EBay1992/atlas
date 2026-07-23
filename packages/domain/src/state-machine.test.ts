import { describe, expect, it } from "vitest";
import {
  assertJobTransition,
  canJobTransition,
  IllegalStateTransitionError,
  isTerminalJobStatus,
} from "./state-machine.js";

describe("job state machine", () => {
  it("allows queued → processing → completed", () => {
    expect(canJobTransition("queued", "processing")).toBe(true);
    expect(canJobTransition("processing", "completed")).toBe(true);
  });

  it("rejects completed → processing", () => {
    expect(canJobTransition("completed", "processing")).toBe(false);
    expect(() => assertJobTransition("completed", "processing")).toThrow(
      IllegalStateTransitionError,
    );
  });

  it("marks terminal states", () => {
    expect(isTerminalJobStatus("completed")).toBe(true);
    expect(isTerminalJobStatus("failed")).toBe(true);
    expect(isTerminalJobStatus("queued")).toBe(false);
  });
});

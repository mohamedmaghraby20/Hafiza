import { describe, expect, it, vi } from "vitest";

import { SyncOrchestrator, type SyncStatus } from "./SyncOrchestrator";

describe("SyncOrchestrator", () => {
  it("retries failures and publishes status without starting duplicate runs", async () => {
    const statuses: SyncStatus[] = [];
    const delay = vi.fn(() => Promise.resolve());
    const task = vi
      .fn<() => Promise<{ pushed: number; pulled: number }>>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue({ pushed: 1, pulled: 2 });
    const orchestrator = new SyncOrchestrator(delay);
    orchestrator.subscribe((status) => statuses.push(status));

    const first = orchestrator.run(task);
    const duplicate = orchestrator.run(task);

    expect(duplicate).toBe(first);
    await expect(first).resolves.toEqual({ pushed: 1, pulled: 2 });
    expect(task).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(300);
    expect(statuses.map(({ phase }) => phase)).toEqual([
      "idle",
      "syncing",
      "synced",
    ]);
  });

  it("reports a terminal error after bounded retries", async () => {
    const statuses: SyncStatus[] = [];
    const task = vi.fn(() => Promise.reject(new Error("Drive unavailable")));
    const orchestrator = new SyncOrchestrator(() => Promise.resolve());
    orchestrator.subscribe((status) => statuses.push(status));

    await expect(orchestrator.run(task, 1)).rejects.toThrow(
      "Drive unavailable",
    );
    expect(task).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toMatchObject({
      phase: "error",
      message: "Drive unavailable",
    });
  });
});

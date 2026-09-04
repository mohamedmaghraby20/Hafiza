import type { SyncResult } from "./IncrementalSyncService";

export type SyncPhase = "idle" | "syncing" | "synced" | "error";

export interface SyncStatus {
  readonly phase: SyncPhase;
  readonly message: string;
  readonly lastSyncedAt: Date | null;
}

type SyncTask = () => Promise<SyncResult>;
type Delay = (milliseconds: number) => Promise<void>;

const wait: Delay = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export class SyncOrchestrator {
  private inFlight: Promise<SyncResult> | null = null;
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private status: SyncStatus = {
    phase: "idle",
    message: "Local data is up to date",
    lastSyncedAt: null,
  };

  constructor(private readonly delay: Delay = wait) {}

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  run(task: SyncTask, retries = 2): Promise<SyncResult> {
    if (this.inFlight) return this.inFlight;
    this.publish({ ...this.status, phase: "syncing", message: "Syncing…" });
    this.inFlight = this.attempt(task, retries)
      .then(
        (result) => {
          this.publish({
            phase: "synced",
            message: "Synced just now",
            lastSyncedAt: new Date(),
          });
          return result;
        },
        (error: unknown) => {
          this.publish({
            ...this.status,
            phase: "error",
            message: error instanceof Error ? error.message : "Sync failed",
          });
          throw error;
        },
      )
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  private async attempt(task: SyncTask, retries: number): Promise<SyncResult> {
    let failure: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await task();
      } catch (error: unknown) {
        failure = error;
        if (attempt < retries) await this.delay(300 * 3 ** attempt);
      }
    }
    throw failure;
  }

  private publish(status: SyncStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

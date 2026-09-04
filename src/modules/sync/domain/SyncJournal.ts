import type { EntityId } from "@shared/index";
import type { SyncOperation } from "@shared/infrastructure/database";

export interface JournalOperation extends SyncOperation {
  readonly payload: unknown;
}

export interface SyncJournal {
  readonly format: "hafiza-sync";
  readonly formatVersion: 1;
  readonly deviceId: EntityId;
  readonly updatedAt: string;
  readonly operations: readonly JournalOperation[];
}

export interface RemoteJournalProvider {
  list(accessToken: string): Promise<readonly SyncJournal[]>;
  save(journal: SyncJournal, accessToken: string): Promise<void>;
}

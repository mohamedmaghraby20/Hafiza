import type {
  AppliedSyncOperation,
  DailyStudyStats,
  DeviceRecord,
  PersistedCard,
  PersistedDeck,
  SyncOperation,
} from "@shared/infrastructure/database";
import type { CardTag, Folder, Tag } from "@modules/library";
import type {
  ReviewEvent,
  StudySession,
  StudySessionItem,
} from "@modules/study";

export interface HafizaBackup {
  readonly format: "hafiza";
  readonly formatVersion: 1;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly data: {
    readonly decks: readonly PersistedDeck[];
    readonly cards: readonly PersistedCard[];
    readonly tags: readonly Tag[];
    readonly folders: readonly Folder[];
    readonly cardTags: readonly CardTag[];
    readonly reviews: readonly ReviewEvent[];
    readonly sessions: readonly StudySession[];
    readonly sessionItems: readonly StudySessionItem[];
    readonly dailyStats: readonly DailyStudyStats[];
    readonly syncOperations: readonly SyncOperation[];
    readonly devices: readonly DeviceRecord[];
    readonly appliedSyncOperations: readonly AppliedSyncOperation[];
  };
}

export interface BackupProvider {
  create(): Promise<HafizaBackup>;
  parse(serialized: string): HafizaBackup;
  restore(backup: HafizaBackup): Promise<void>;
}

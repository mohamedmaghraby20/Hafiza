import Dexie, { type EntityTable, type Table } from "dexie";

import type { Card } from "@modules/cards";
import type { Deck } from "@modules/decks";
import type { CardTag, Folder, Tag } from "@modules/library";
import type {
  ReviewEvent,
  StudySession,
  StudySessionItem,
} from "@modules/study";
import type { CardAsset } from "@modules/cards";
import type { EntityId } from "@shared/index";

export interface PersistedDeck extends Deck {
  readonly active: 0 | 1;
}

export interface PersistedCard extends Card {
  readonly active: 0 | 1;
  readonly dueAt: Date;
  readonly normalizedFront: string;
}

export interface DailyStudyStats {
  readonly date: string;
  readonly reviewedCards: number;
  readonly correctReviews: number;
  readonly studyTimeMs: number;
}

export interface SyncOperation {
  readonly id: EntityId;
  readonly entityType: "deck" | "card" | "tag" | "folder" | "review" | "asset";
  readonly entityId: EntityId;
  readonly operation: "upsert" | "delete";
  readonly occurredAt: Date;
  readonly deviceId: EntityId;
  readonly status: "pending" | "synced";
}

export interface DeviceRecord {
  readonly id: EntityId;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AppliedSyncOperation {
  readonly id: EntityId;
  readonly appliedAt: Date;
}

export interface SyncCursorRecord {
  readonly deviceId: EntityId;
  readonly lastSequence: number;
  readonly updatedAt: Date;
}

export class HafizaDatabase extends Dexie {
  decks!: EntityTable<PersistedDeck, "id">;
  cards!: EntityTable<PersistedCard, "id">;
  assets!: EntityTable<CardAsset, "id">;
  tags!: EntityTable<Tag, "id">;
  folders!: EntityTable<Folder, "id">;
  cardTags!: Table<CardTag, [EntityId, EntityId]>;
  reviews!: EntityTable<ReviewEvent, "id">;
  sessions!: EntityTable<StudySession, "id">;
  sessionItems!: EntityTable<StudySessionItem, "id">;
  dailyStats!: EntityTable<DailyStudyStats, "date">;
  syncOperations!: EntityTable<SyncOperation, "id">;
  devices!: EntityTable<DeviceRecord, "id">;
  appliedSyncOperations!: EntityTable<AppliedSyncOperation, "id">;
  syncCursors!: EntityTable<SyncCursorRecord, "deviceId">;

  constructor(name = "hafiza") {
    super(name);
    this.version(1).stores({
      decks: "id, active, name, folderId, [active+name], [folderId+active]",
      cards:
        "id, active, deckId, dueAt, normalizedFront, [deckId+active], [active+dueAt], [deckId+active+dueAt]",
      tags: "id, name, deletedAt",
      folders: "id, parentId, name, deletedAt",
      cardTags: "[cardId+tagId], cardId, tagId",
      reviews: "id, cardId, sessionId, reviewedAt, [cardId+reviewedAt]",
      sessions: "id, deckId, startedAt, completedAt",
      sessionItems: "id, sessionId, cardId, [sessionId+position]",
      dailyStats: "date",
      syncOperations: "id, status, occurredAt, [status+occurredAt]",
    });
    this.version(2).stores({
      devices: "id, updatedAt",
    });
    this.version(3).stores({
      appliedSyncOperations: "id, appliedAt",
    });
    this.version(4).stores({
      syncCursors: "deviceId, updatedAt",
    });
    this.version(5).stores({
      assets: "id, cardId, kind, createdAt",
    });
    // Legacy cards predate flexible card types. Materialize the default kind
    // once during migration so every later read/sync can rely on it.
    this.version(6)
      .stores({})
      .upgrade((transaction) =>
        transaction
          .table("cards")
          .toCollection()
          .modify((card: { kind?: string }) => {
            if (!card.kind) card.kind = "basic";
          }),
      );
  }
}

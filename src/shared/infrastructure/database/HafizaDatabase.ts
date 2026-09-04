import Dexie, { type EntityTable, type Table } from "dexie";

import type { Card } from "@modules/cards";
import type { Deck } from "@modules/decks";
import type { CardTag, Folder, Tag } from "@modules/library";
import type {
  ReviewEvent,
  StudySession,
  StudySessionItem,
} from "@modules/study";
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
  readonly entityType: "deck" | "card" | "tag" | "folder" | "review";
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

export class HafizaDatabase extends Dexie {
  decks!: EntityTable<PersistedDeck, "id">;
  cards!: EntityTable<PersistedCard, "id">;
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
  }
}

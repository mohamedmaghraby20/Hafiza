import type {
  Clock,
  EntityId,
  IdGenerator,
  Result,
  SyncedEntity,
} from "@shared/index";
import { trimmedStringSchema, validate } from "@shared/index";

export interface Deck extends SyncedEntity {
  readonly name: string;
  readonly description: string;
  readonly folderId: EntityId | null;
}

export interface CreateDeckInput {
  readonly name: string;
  readonly description?: string;
  readonly folderId?: EntityId | null;
  readonly deviceId: EntityId;
}

export function createDeck(
  input: CreateDeckInput,
  dependencies: { readonly clock: Clock; readonly ids: IdGenerator },
): Result<Deck, import("@shared/index").ValidationError> {
  const name = validate(trimmedStringSchema("Deck name", 120), input.name);
  if (!name.ok) return name;
  const now = dependencies.clock.now();
  return {
    ok: true,
    value: {
      id: dependencies.ids.next(),
      name: name.value,
      description: input.description?.trim() ?? "",
      folderId: input.folderId ?? null,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      updatedByDeviceId: input.deviceId,
      deletedAt: null,
    },
  };
}

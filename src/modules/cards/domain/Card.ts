import type {
  Clock,
  EntityId,
  IdGenerator,
  Result,
  SyncedEntity,
} from "@shared/index";
import { trimmedStringSchema, validate } from "@shared/index";

export type CardKind = "basic";
export type CardPhase = "new" | "learning" | "review" | "relearning";

export interface SchedulingState {
  readonly phase: CardPhase;
  readonly dueAt: Date;
  readonly intervalDays: number;
  readonly easeFactor: number;
  readonly repetitions: number;
  readonly lapses: number;
}

export interface Card extends SyncedEntity {
  readonly deckId: EntityId;
  readonly kind: CardKind;
  readonly front: string;
  readonly back: string;
  readonly scheduling: SchedulingState;
}

export interface CreateCardInput {
  readonly deckId: EntityId;
  readonly front: string;
  readonly back: string;
  readonly deviceId: EntityId;
}

export function createCard(
  input: CreateCardInput,
  dependencies: { readonly clock: Clock; readonly ids: IdGenerator },
): Result<Card, import("@shared/index").ValidationError> {
  const front = validate(
    trimmedStringSchema("Card front", 10_000),
    input.front,
  );
  if (!front.ok) return front;
  const back = validate(trimmedStringSchema("Card back", 10_000), input.back);
  if (!back.ok) return back;
  const now = dependencies.clock.now();
  return {
    ok: true,
    value: {
      id: dependencies.ids.next(),
      deckId: input.deckId,
      kind: "basic",
      front: front.value,
      back: back.value,
      scheduling: {
        phase: "new",
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
      },
      createdAt: now,
      updatedAt: now,
      revision: 1,
      updatedByDeviceId: input.deviceId,
      deletedAt: null,
    },
  };
}

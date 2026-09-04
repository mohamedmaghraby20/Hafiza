import type { CreateCardUseCase } from "@modules/cards";
import type { CardTagRepository, TagRepository } from "@modules/library";
import type {
  Clock,
  EntityId,
  IdGenerator,
  TransactionRunner,
} from "@shared/index";

import type { ImportPreview } from "../domain/ImportModel";

export class ImportCardsUseCase {
  constructor(
    private readonly createCard: CreateCardUseCase,
    private readonly transactions: TransactionRunner,
    private readonly tags: TagRepository,
    private readonly cardTags: CardTagRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  execute(
    preview: ImportPreview,
    deckId: EntityId,
    deviceId: EntityId,
  ): Promise<{
    readonly cardIds: readonly EntityId[];
    readonly tagIds: readonly EntityId[];
  }> {
    return this.transactions.run(async () => {
      const imported: EntityId[] = [];
      const createdTagIds: EntityId[] = [];
      const tagsByName = new Map(
        (await this.tags.list()).map((tag) => [
          tag.name.toLocaleLowerCase(),
          tag,
        ]),
      );
      for (const card of preview.cards) {
        const result = await this.createCard.execute({
          deckId,
          front: card.front,
          back: card.back,
          deviceId,
        });
        if (!result.ok) throw result.error;
        imported.push(result.value.id);
        const links = [];
        for (const rawName of card.tags) {
          const name = rawName.trim();
          if (!name) continue;
          const key = name.toLocaleLowerCase();
          let tag = tagsByName.get(key);
          if (!tag) {
            const now = this.clock.now();
            tag = {
              id: this.ids.next(),
              name,
              createdAt: now,
              updatedAt: now,
              revision: 1,
              updatedByDeviceId: deviceId,
              deletedAt: null,
            };
            await this.tags.save(tag);
            tagsByName.set(key, tag);
            createdTagIds.push(tag.id);
          }
          links.push({
            cardId: result.value.id,
            tagId: tag.id,
            createdAt: this.clock.now(),
          });
        }
        await this.cardTags.replaceForCard(result.value.id, links);
      }
      return { cardIds: imported, tagIds: createdTagIds };
    });
  }
}

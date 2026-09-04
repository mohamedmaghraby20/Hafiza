import type { EntityId } from "@shared/index";
import type { HafizaDatabase } from "@shared/infrastructure/database/HafizaDatabase";

import type { CardTag, Folder, Tag } from "../domain/Taxonomy";
import type {
  CardTagRepository,
  FolderRepository,
  TagRepository,
} from "../domain/TaxonomyRepository";

export class DexieTagRepository implements TagRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async save(tag: Tag): Promise<void> {
    await this.database.tags.put(tag);
  }

  async findById(id: EntityId): Promise<Tag | null> {
    const tag = await this.database.tags.get(id);
    return tag && tag.deletedAt === null ? tag : null;
  }

  async list(): Promise<readonly Tag[]> {
    return this.database.tags
      .orderBy("name")
      .filter((tag) => tag.deletedAt === null)
      .toArray();
  }
}

export class DexieFolderRepository implements FolderRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async save(folder: Folder): Promise<void> {
    await this.database.folders.put(folder);
  }

  async findById(id: EntityId): Promise<Folder | null> {
    const folder = await this.database.folders.get(id);
    return folder && folder.deletedAt === null ? folder : null;
  }

  async list(): Promise<readonly Folder[]> {
    return this.database.folders
      .orderBy("name")
      .filter((folder) => folder.deletedAt === null)
      .toArray();
  }
}

export class DexieCardTagRepository implements CardTagRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async replaceForCard(
    cardId: EntityId,
    links: readonly CardTag[],
  ): Promise<void> {
    await this.database.transaction("rw", this.database.cardTags, async () => {
      await this.database.cardTags.where("cardId").equals(cardId).delete();
      await this.database.cardTags.bulkPut([...links]);
    });
  }

  async listForCard(cardId: EntityId): Promise<readonly CardTag[]> {
    return this.database.cardTags.where("cardId").equals(cardId).toArray();
  }
}

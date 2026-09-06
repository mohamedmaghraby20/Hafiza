import {
  CreateCardUseCase,
  DexieCardAssetRepository,
  DeleteCardUseCase,
  DexieCardRepository,
  EditCardUseCase,
} from "@modules/cards";
import {
  DexieBackupProvider,
  BackupCompressionWorkerClient,
  GoogleDriveBackupProvider,
  GoogleOAuthTokenProvider,
} from "@modules/backup";
import { CreateDeckUseCase, DexieDeckRepository } from "@modules/decks";
import { CsvImportWorkerClient, ImportCardsUseCase } from "@modules/import";
import {
  DexieCardTagRepository,
  DexieFolderRepository,
  DexieTagRepository,
  LibraryQueries,
} from "@modules/library";
import { DexieProgressRepository, GetProgressUseCase } from "@modules/progress";
import {
  DexieDailyStudyStatsRepository,
  DexieReviewRepository,
  DexieStudySessionRepository,
  DexieSyncOperationRepository,
  MvpScheduler,
  ReviewCardUseCase,
  StudyQueue,
  StudySessionService,
  type Rating,
} from "@modules/study";
import type { CardAsset, CardAssetInput } from "@modules/cards";
import {
  DexieDeviceIdentityRepository,
  GoogleDriveJournalProvider,
  IncrementalSyncService,
  SyncOrchestrator,
  type SyncStatus,
} from "@modules/sync";
import {
  SystemClock,
  measureOperation,
  trimmedStringSchema,
  UuidV7IdGenerator,
  validate,
  type EntityId,
} from "@shared/index";
import {
  DexieTransactionRunner,
  HafizaDatabase,
} from "@shared/infrastructure/database";

import type {
  CsvPreviewData,
  HafizaAppPort,
  LibraryCard,
  LibraryDeck,
  LibraryFolder,
  ProgressData,
  StudyState,
  CardContentOptions,
} from "../App";

const MAIN_DECK_NAME = "Main Deck";

/**
 * Projects the persisted card into the prompt/answer shown in a session.
 * Reverse cards intentionally keep their source data unchanged and only swap
 * the study projection. Cloze syntax stays plain-text compatible so old cards
 * can opt in without a migration.
 */
function studyContent(card: {
  readonly kind?: "basic" | "basic-reverse" | "cloze" | "rich-media";
  readonly front: string;
  readonly back: string;
  readonly frontFormat?: "plain" | "rich";
  readonly backFormat?: "plain" | "rich";
}) {
  if (card.kind === "basic-reverse") {
    return {
      front: card.back,
      back: card.front,
      frontFormat: card.backFormat,
      backFormat: card.frontFormat,
    };
  }
  if (card.kind === "cloze") {
    const clozePattern = /\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g;
    const answers: string[] = [];
    const front = card.front.replace(clozePattern, (_match, answer: string) => {
      answers.push(answer);
      return "[…]";
    });
    return {
      front,
      back:
        answers.length > 0 ? `${card.back}\n${answers.join(", ")}` : card.back,
      frontFormat: card.frontFormat,
      backFormat: card.backFormat,
    };
  }
  return {
    front: card.front,
    back: card.back,
    frontFormat: card.frontFormat,
    backFormat: card.backFormat,
  };
}

export class LocalHafizaApplication implements HafizaAppPort {
  readonly #database = new HafizaDatabase();
  readonly #ids = new UuidV7IdGenerator();
  readonly #clock = new SystemClock();
  readonly #decks = new DexieDeckRepository(this.#database);
  readonly #cards = new DexieCardRepository(this.#database);
  readonly #assets = new DexieCardAssetRepository(this.#database);
  readonly #folders = new DexieFolderRepository(this.#database);
  readonly #transactions = new DexieTransactionRunner(this.#database);
  readonly #sessions = new DexieStudySessionRepository(this.#database);
  readonly #identity = new DexieDeviceIdentityRepository(
    this.#database,
    this.#ids,
  );
  readonly #syncOperations = new DexieSyncOperationRepository(this.#database);
  readonly #createDeck = new CreateDeckUseCase(
    this.#decks,
    this.#clock,
    this.#ids,
  );
  readonly #createCard = new CreateCardUseCase(
    this.#cards,
    this.#decks,
    this.#clock,
    this.#ids,
  );
  readonly #editCard = new EditCardUseCase(this.#cards, this.#clock);
  readonly #deleteCard = new DeleteCardUseCase(this.#cards, this.#clock);
  readonly #library = new LibraryQueries(this.#decks, this.#cards);
  readonly #review = new ReviewCardUseCase(
    this.#cards,
    new DexieReviewRepository(this.#database),
    this.#sessions,
    new DexieDailyStudyStatsRepository(this.#database),
    this.#syncOperations,
    new MvpScheduler(),
    this.#transactions,
    this.#clock,
    this.#ids,
  );
  readonly #study = new StudySessionService(
    this.#sessions,
    this.#cards,
    new StudyQueue(this.#cards),
    this.#review,
    this.#transactions,
    this.#clock,
    this.#ids,
  );
  readonly #progress = new GetProgressUseCase(
    new DexieProgressRepository(this.#database),
  );
  readonly #csv = new CsvImportWorkerClient();
  readonly #import = new ImportCardsUseCase(
    this.#createCard,
    this.#transactions,
    new DexieTagRepository(this.#database),
    new DexieCardTagRepository(this.#database),
    this.#clock,
    this.#ids,
  );
  readonly #backup = new DexieBackupProvider(this.#database);
  readonly #backupCompression = new BackupCompressionWorkerClient();
  readonly #drive = new GoogleDriveBackupProvider();
  readonly #googleAuth = new GoogleOAuthTokenProvider(
    import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  );
  readonly #sync = new IncrementalSyncService(
    this.#database,
    new GoogleDriveJournalProvider(),
  );
  readonly #syncOrchestrator = new SyncOrchestrator();

  async #ensureMainDeck(): Promise<EntityId> {
    await this.#database.open();
    const existing = await this.#decks.findByName(MAIN_DECK_NAME);
    if (existing) return existing.id;
    const deviceId = await this.#deviceId();
    return this.#transactions.run(async () => {
      const alreadyCreated = await this.#decks.findByName(MAIN_DECK_NAME);
      if (alreadyCreated) return alreadyCreated.id;
      const result = await this.#createDeck.execute({
        name: MAIN_DECK_NAME,
        folderId: null,
        deviceId,
      });
      if (!result.ok) throw result.error;
      await this.#enqueueSync("deck", result.value.id, "upsert", deviceId);
      return result.value.id;
    });
  }

  async #deviceId(): Promise<EntityId> {
    await this.#database.open();
    return this.#identity.getOrCreate();
  }

  async loadLibrary(): Promise<readonly LibraryDeck[]> {
    return measureOperation("hafiza.library.load", async () => {
      await this.#database.open();
      await this.#ensureMainDeck();
      const page = await this.#library.listDecks(
        { offset: 0, limit: 100 },
        this.#clock.now(),
      );
      return page.items.map(({ deck, cardCount, dueCount }) => ({
        id: deck.id,
        name: deck.name,
        cardCount,
        dueCount,
        folderId: deck.folderId,
      }));
    });
  }

  async loadFolders(): Promise<readonly LibraryFolder[]> {
    await this.#database.open();
    return (await this.#folders.list()).map(({ id, name }) => ({ id, name }));
  }

  async createDeck(name: string, folderId?: string): Promise<void> {
    const deviceId = await this.#deviceId();
    await this.#transactions.run(async () => {
      const result = await this.#createDeck.execute({
        name,
        folderId: folderId ? (folderId as EntityId) : null,
        deviceId,
      });
      if (!result.ok) throw result.error;
      await this.#enqueueSync("deck", result.value.id, "upsert", deviceId);
    });
  }

  async createFolder(name: string): Promise<void> {
    const deviceId = await this.#deviceId();
    const validated = validate(trimmedStringSchema("Folder name", 120), name);
    if (!validated.ok) throw validated.error;
    await this.#transactions.run(async () => {
      const now = this.#clock.now();
      const folder = {
        id: this.#ids.next(),
        name: validated.value,
        parentId: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        updatedByDeviceId: deviceId,
        deletedAt: null,
      };
      await this.#folders.save(folder);
      await this.#enqueueSync("folder", folder.id, "upsert", deviceId);
    });
  }

  async createCard(
    deckId: string | undefined,
    front: string,
    back: string,
    options?: CardContentOptions,
  ): Promise<void> {
    const targetDeckId = deckId?.trim()
      ? (deckId as EntityId)
      : await this.#ensureMainDeck();
    const deviceId = await this.#deviceId();
    await this.#transactions.run(async () => {
      const result = await this.#createCard.execute({
        deckId: targetDeckId,
        front,
        back,
        deviceId,
        ...options,
      });
      if (!result.ok) throw result.error;
      if (options?.assets) {
        const previousAssets = await this.#assets.listByCard(result.value.id);
        const removedAt = this.#clock.now();
        for (const asset of previousAssets) {
          await this.#assets.softDelete(asset.id, removedAt, deviceId);
          await this.#enqueueSync("asset", asset.id, "delete", deviceId);
        }
        const assets = this.#createAssets(
          result.value.id,
          options.assets,
          deviceId,
        );
        await this.#assets.replaceForCard(result.value.id, assets);
        await this.#cards.save({
          ...result.value,
          assetIds: assets.map((asset) => asset.id),
        });
        for (const asset of assets) {
          await this.#enqueueSync("asset", asset.id, "upsert", deviceId);
        }
      }
      await this.#enqueueSync("card", result.value.id, "upsert", deviceId);
    });
  }

  async loadCards(
    deckId: string,
    search?: string,
  ): Promise<readonly LibraryCard[]> {
    const page = await this.loadCardsPage(deckId, search);
    return page.items;
  }

  async loadCardsPage(
    deckId: string,
    search?: string,
    offset = 0,
    limit = 200,
  ): Promise<{
    readonly items: readonly LibraryCard[];
    readonly total: number;
  }> {
    await this.#database.open();
    const page = await this.#library.searchCards({
      deckId: deckId as EntityId,
      ...(search ? { text: search } : {}),
      offset,
      limit,
    });
    const assets = await this.#assets.listByCards(
      page.items.map((card) => card.id),
    );
    const assetsByCard = new Map<string, CardAsset[]>();
    for (const asset of assets) {
      const current = assetsByCard.get(asset.cardId) ?? [];
      current.push(asset);
      assetsByCard.set(asset.cardId, current);
    }
    const items = page.items.map((card) => ({
      id: card.id,
      deckId: card.deckId,
      front: card.front,
      back: card.back,
      kind: card.kind,
      ...(card.frontFormat ? { frontFormat: card.frontFormat } : {}),
      ...(card.backFormat ? { backFormat: card.backFormat } : {}),
      phase: card.scheduling.phase,
      dueAt: card.scheduling.dueAt,
      assets: assetsByCard.get(card.id) ?? [],
    }));
    return { total: page.total, items };
  }

  async editCard(
    id: string,
    front: string,
    back: string,
    options?: CardContentOptions,
  ): Promise<void> {
    const deviceId = await this.#deviceId();
    await this.#transactions.run(async () => {
      const result = await this.#editCard.execute({
        id: id as EntityId,
        front,
        back,
        deviceId,
        ...options,
      });
      if (!result.ok) throw result.error;
      if (options?.assets) {
        const previousAssets = await this.#assets.listByCard(result.value.id);
        const removedAt = this.#clock.now();
        for (const asset of previousAssets) {
          await this.#assets.softDelete(asset.id, removedAt, deviceId);
          await this.#enqueueSync("asset", asset.id, "delete", deviceId);
        }
        const assets = this.#createAssets(
          result.value.id,
          options.assets,
          deviceId,
        );
        await this.#assets.replaceForCard(result.value.id, assets);
        await this.#cards.save({
          ...result.value,
          assetIds: assets.map((asset) => asset.id),
        });
        for (const asset of assets) {
          await this.#enqueueSync("asset", asset.id, "upsert", deviceId);
        }
      }
      await this.#enqueueSync("card", result.value.id, "upsert", deviceId);
    });
  }

  #createAssets(
    cardId: EntityId,
    inputs: readonly CardAssetInput[],
    deviceId: EntityId,
  ): readonly CardAsset[] {
    const now = this.#clock.now();
    return inputs.map((input) => ({
      id: this.#ids.next(),
      cardId,
      kind: input.kind,
      ...(input.side ? { side: input.side } : {}),
      name: input.name.slice(0, 160),
      mimeType: input.mimeType,
      data: input.data,
      size: input.size,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      updatedByDeviceId: deviceId,
      deletedAt: null,
    }));
  }

  async deleteCard(id: string): Promise<void> {
    const deviceId = await this.#deviceId();
    await this.#transactions.run(async () => {
      await this.#deleteCard.execute({ id: id as EntityId, deviceId });
      const deletedAt = this.#clock.now();
      const assets = await this.#assets.listByCard(id as EntityId);
      for (const asset of assets) {
        await this.#assets.softDelete(asset.id, deletedAt, deviceId);
        await this.#enqueueSync("asset", asset.id, "delete", deviceId);
      }
      await this.#enqueueSync("card", id as EntityId, "delete", deviceId);
    });
  }

  async #enqueueSync(
    entityType: "deck" | "card" | "tag" | "folder" | "review" | "asset",
    entityId: EntityId,
    operation: "upsert" | "delete",
    deviceId: EntityId,
  ): Promise<void> {
    await this.#syncOperations.enqueue({
      id: this.#ids.next(),
      entityType,
      entityId,
      operation,
      occurredAt: this.#clock.now(),
      deviceId,
      status: "pending",
    });
  }

  async startStudy(deckId?: string): Promise<StudyState> {
    await this.#database.open();
    const session = await this.#study.start(
      deckId ? { deckId: deckId as EntityId } : {},
    );
    return this.#studyState(session.id);
  }

  async revealStudy(itemId: string): Promise<void> {
    await this.#study.reveal(itemId as EntityId);
  }

  async rateStudy(
    sessionId: string,
    itemId: string,
    rating: Rating,
  ): Promise<StudyState> {
    return measureOperation("hafiza.study.rate-to-next", async () => {
      await this.#study.rate({
        sessionItemId: itemId as EntityId,
        rating,
        deviceId: await this.#deviceId(),
      });
      return this.#studyState(sessionId as EntityId);
    });
  }

  async #studyState(sessionId: EntityId): Promise<StudyState> {
    const next = await this.#study.next(sessionId);
    const items = await this.#sessions.listItems(sessionId);
    if (!next) {
      await this.#study.complete(sessionId);
      return {
        sessionId,
        itemId: null,
        current: items.length,
        total: items.length,
        card: null,
      };
    }
    const projected = studyContent(next.card);
    const cardAssets = await this.#assets.listByCard(next.card.id);
    const projectedAssets =
      next.card.kind === "basic-reverse"
        ? cardAssets.map((asset) => ({
            ...asset,
            side:
              asset.side === "back" ? ("front" as const) : ("back" as const),
          }))
        : cardAssets;
    return {
      sessionId,
      itemId: next.item.id,
      current: next.session.reviewedCount + 1,
      total: items.length,
      card: {
        id: next.card.id,
        deckId: next.card.deckId,
        front: projected.front,
        back: projected.back,
        kind: next.card.kind,
        ...(projected.frontFormat
          ? { frontFormat: projected.frontFormat }
          : {}),
        ...(projected.backFormat ? { backFormat: projected.backFormat } : {}),
        phase: next.card.scheduling.phase,
        dueAt: next.card.scheduling.dueAt,
        assets: projectedAssets,
      },
    };
  }

  async loadProgress(): Promise<ProgressData> {
    return measureOperation("hafiza.progress.load", async () => {
      await this.#database.open();
      const progress = await this.#progress.execute();
      return {
        reviewedCards: progress.reviewedCards,
        retentionPercent: progress.retentionPercent,
        studyTimeMs: progress.studyTimeMs,
        days: progress.days.map(({ date, reviewedCards }) => ({
          date,
          reviewedCards,
        })),
      };
    });
  }

  previewCsv(fileName: string, content: string): Promise<CsvPreviewData> {
    return measureOperation("hafiza.import.parse", () =>
      this.#csv.parse(fileName, content),
    );
  }

  previewXlsx(fileName: string, content: ArrayBuffer): Promise<CsvPreviewData> {
    return measureOperation("hafiza.import.parse", () =>
      this.#csv.parseXlsx(fileName, content),
    );
  }

  async importCards(preview: CsvPreviewData, deckId: string): Promise<number> {
    return measureOperation("hafiza.import.commit", async () => {
      const deviceId = await this.#deviceId();
      return this.#transactions.run(async () => {
        const imported = await this.#import.execute(
          preview,
          deckId as EntityId,
          deviceId,
        );
        for (const id of imported.cardIds) {
          await this.#enqueueSync("card", id, "upsert", deviceId);
        }
        for (const id of imported.tagIds) {
          await this.#enqueueSync("tag", id, "upsert", deviceId);
        }
        return imported.cardIds.length;
      });
    });
  }

  async exportBackup(): Promise<string> {
    await this.#database.open();
    return JSON.stringify(await this.#backup.create());
  }

  async exportBackupFile(): Promise<ArrayBuffer> {
    return measureOperation("hafiza.backup.export", async () =>
      this.#backupCompression.compress(await this.exportBackup()),
    );
  }

  decodeBackupFile(buffer: ArrayBuffer): Promise<string> {
    return this.#backupCompression.decompress(buffer);
  }

  inspectBackup(serialized: string) {
    const backup = this.#backup.parse(serialized);
    return {
      exportedAt: backup.exportedAt,
      deckCount: backup.data.decks.length,
      cardCount: backup.data.cards.length,
    };
  }

  async restoreBackup(serialized: string): Promise<void> {
    await this.#database.open();
    await this.#backup.restore(this.#backup.parse(serialized));
  }

  driveEnabled(): boolean {
    return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  }

  async backupToDrive(): Promise<void> {
    const [token, serialized] = await Promise.all([
      this.#googleAuth.request(),
      this.exportBackup(),
    ]);
    await this.#drive.upload(serialized, token);
  }

  async restoreFromDrive(): Promise<void> {
    const token = await this.#googleAuth.request();
    const serialized = await this.#drive.downloadLatest(token);
    await this.restoreBackup(serialized);
  }

  async syncNow() {
    const token = await this.#googleAuth.request();
    return this.#syncOrchestrator.run(async () =>
      this.#sync.sync(await this.#deviceId(), token),
    );
  }

  async syncIfConnected() {
    const token = this.#googleAuth.current();
    if (!token) return null;
    return this.#syncOrchestrator.run(async () =>
      this.#sync.sync(await this.#deviceId(), token),
    );
  }

  subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
    return this.#syncOrchestrator.subscribe(listener);
  }

  disconnectDrive(): void {
    this.#googleAuth.revoke();
  }
}

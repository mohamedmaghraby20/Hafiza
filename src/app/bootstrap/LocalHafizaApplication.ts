import {
  CreateCardUseCase,
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
import {
  DexieDeviceIdentityRepository,
  GoogleDriveJournalProvider,
  IncrementalSyncService,
} from "@modules/sync";
import {
  SystemClock,
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
} from "../App";

export class LocalHafizaApplication implements HafizaAppPort {
  readonly #database = new HafizaDatabase();
  readonly #ids = new UuidV7IdGenerator();
  readonly #clock = new SystemClock();
  readonly #decks = new DexieDeckRepository(this.#database);
  readonly #cards = new DexieCardRepository(this.#database);
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

  async #deviceId(): Promise<EntityId> {
    await this.#database.open();
    return this.#identity.getOrCreate();
  }

  async loadLibrary(): Promise<readonly LibraryDeck[]> {
    await this.#database.open();
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

  async createCard(deckId: string, front: string, back: string): Promise<void> {
    const deviceId = await this.#deviceId();
    await this.#transactions.run(async () => {
      const result = await this.#createCard.execute({
        deckId: deckId as EntityId,
        front,
        back,
        deviceId,
      });
      if (!result.ok) throw result.error;
      await this.#enqueueSync("card", result.value.id, "upsert", deviceId);
    });
  }

  async loadCards(
    deckId: string,
    search?: string,
  ): Promise<readonly LibraryCard[]> {
    await this.#database.open();
    const page = await this.#library.searchCards({
      deckId: deckId as EntityId,
      ...(search ? { text: search } : {}),
      offset: 0,
      limit: 200,
    });
    return page.items.map((card) => ({
      id: card.id,
      deckId: card.deckId,
      front: card.front,
      back: card.back,
      phase: card.scheduling.phase,
      dueAt: card.scheduling.dueAt,
    }));
  }

  async editCard(id: string, front: string, back: string): Promise<void> {
    const deviceId = await this.#deviceId();
    await this.#transactions.run(async () => {
      const result = await this.#editCard.execute({
        id: id as EntityId,
        front,
        back,
        deviceId,
      });
      if (!result.ok) throw result.error;
      await this.#enqueueSync("card", result.value.id, "upsert", deviceId);
    });
  }

  async deleteCard(id: string): Promise<void> {
    const deviceId = await this.#deviceId();
    await this.#transactions.run(async () => {
      await this.#deleteCard.execute({ id: id as EntityId, deviceId });
      await this.#enqueueSync("card", id as EntityId, "delete", deviceId);
    });
  }

  async #enqueueSync(
    entityType: "deck" | "card" | "tag" | "folder" | "review",
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
    await this.#study.rate({
      sessionItemId: itemId as EntityId,
      rating,
      deviceId: await this.#deviceId(),
    });
    return this.#studyState(sessionId as EntityId);
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
    return {
      sessionId,
      itemId: next.item.id,
      current: next.session.reviewedCount + 1,
      total: items.length,
      card: {
        id: next.card.id,
        deckId: next.card.deckId,
        front: next.card.front,
        back: next.card.back,
        phase: next.card.scheduling.phase,
        dueAt: next.card.scheduling.dueAt,
      },
    };
  }

  async loadProgress(): Promise<ProgressData> {
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
  }

  previewCsv(fileName: string, content: string): Promise<CsvPreviewData> {
    return this.#csv.parse(fileName, content);
  }

  previewXlsx(fileName: string, content: ArrayBuffer): Promise<CsvPreviewData> {
    return this.#csv.parseXlsx(fileName, content);
  }

  async importCards(preview: CsvPreviewData, deckId: string): Promise<number> {
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
  }

  async exportBackup(): Promise<string> {
    await this.#database.open();
    return JSON.stringify(await this.#backup.create());
  }

  async exportBackupFile(): Promise<ArrayBuffer> {
    return this.#backupCompression.compress(await this.exportBackup());
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
    const [token, deviceId] = await Promise.all([
      this.#googleAuth.request(),
      this.#deviceId(),
    ]);
    return this.#sync.sync(deviceId, token);
  }

  disconnectDrive(): void {
    this.#googleAuth.revoke();
  }
}

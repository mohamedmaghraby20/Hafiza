import type { HafizaDatabase } from "@shared/infrastructure/database/HafizaDatabase";

import type {
  DailyStudyStatsRecord,
  DailyStudyStatsRepository,
  PendingSyncOperation,
  SyncOperationRepository,
} from "../application/ReviewSideEffectPorts";

export class DexieDailyStudyStatsRepository implements DailyStudyStatsRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async findByDate(date: string): Promise<DailyStudyStatsRecord | null> {
    return (await this.database.dailyStats.get(date)) ?? null;
  }

  async save(stats: DailyStudyStatsRecord): Promise<void> {
    await this.database.dailyStats.put(stats);
  }
}

export class DexieSyncOperationRepository implements SyncOperationRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async enqueue(operation: PendingSyncOperation): Promise<void> {
    await this.database.syncOperations.add(operation);
  }
}

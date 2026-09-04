import type {
  ProgressRepository,
  ProgressSnapshot,
} from "./ProgressRepository";

export class GetProgressUseCase {
  constructor(private readonly progress: ProgressRepository) {}

  execute(limitDays = 30): Promise<ProgressSnapshot> {
    return this.progress.getSnapshot(Math.max(1, Math.min(limitDays, 366)));
  }
}

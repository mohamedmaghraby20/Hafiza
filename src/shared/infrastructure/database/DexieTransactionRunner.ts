import type { TransactionRunner } from "@shared/index";

import type { HafizaDatabase } from "./HafizaDatabase";

export class DexieTransactionRunner implements TransactionRunner {
  constructor(private readonly database: HafizaDatabase) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.database.transaction("rw", this.database.tables, work);
  }
}

import type { EntityId, IdGenerator } from "@shared/index";
import type { HafizaDatabase } from "@shared/infrastructure/database";

import type { DeviceIdentityRepository } from "../application/DeviceIdentityRepository";

export class DexieDeviceIdentityRepository implements DeviceIdentityRepository {
  constructor(
    private readonly database: HafizaDatabase,
    private readonly ids: IdGenerator,
  ) {}

  async getOrCreate(): Promise<EntityId> {
    const existing = await this.database.devices.orderBy("updatedAt").last();
    if (existing) return existing.id;
    const now = new Date();
    const id = this.ids.next();
    await this.database.devices.add({
      id,
      name: globalThis.navigator?.platform || "Hafiza device",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }
}

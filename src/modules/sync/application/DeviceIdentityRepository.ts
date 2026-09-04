import type { EntityId } from "@shared/index";

export interface DeviceIdentityRepository {
  getOrCreate(): Promise<EntityId>;
}

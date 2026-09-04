import { v7 as createUuidV7 } from "uuid";

declare const entityIdBrand: unique symbol;

export type EntityId = string & { readonly [entityIdBrand]: "EntityId" };

export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface IdGenerator {
  next(): EntityId;
}

export function isEntityId(value: string): value is EntityId {
  return UUID_V7_PATTERN.test(value);
}

export class UuidV7IdGenerator implements IdGenerator {
  next(): EntityId {
    return createUuidV7() as EntityId;
  }
}

import type { CardAssetKind, CardAssetSide } from "./Card";
import type { EntityId, SyncedEntity } from "@shared/index";

/**
 * Assets live in their own table instead of inflating card rows with base64.
 * The data URL is intentionally portable for the MVP: it survives backup,
 * restore, and offline reopening without requiring an object-URL lifecycle.
 */
export interface CardAsset extends SyncedEntity {
  readonly cardId: EntityId;
  readonly kind: CardAssetKind;
  /** Optional for backwards compatibility; missing values are front-side assets. */
  readonly side?: CardAssetSide;
  readonly name: string;
  readonly mimeType: string;
  readonly data: string;
  readonly size: number;
}

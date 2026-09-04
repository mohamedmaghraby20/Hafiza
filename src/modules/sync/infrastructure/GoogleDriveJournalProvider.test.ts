import { describe, expect, it } from "vitest";

import type { SyncJournal } from "@modules/sync";
import { testIds, testInstant } from "@test/domainFixtures";

import { decodeJournal, encodeJournal } from "./GoogleDriveJournalProvider";

describe("GoogleDriveJournalProvider codec", () => {
  it("compresses and restores an ordered version 2 journal", async () => {
    const deviceId = testIds.next();
    const operationId = testIds.next();
    const journal: SyncJournal = {
      format: "hafiza-sync",
      formatVersion: 2,
      deviceId,
      updatedAt: testInstant.toISOString(),
      operations: [
        {
          id: operationId,
          sequence: 1,
          entityType: "deck",
          entityId: testIds.next(),
          operation: "upsert",
          occurredAt: testInstant,
          deviceId,
          status: "synced",
          payload: { name: "Biology" },
        },
      ],
    };

    const encoded = await encodeJournal(journal);
    const decoded = await decodeJournal(encoded);

    expect(decoded).toEqual(journal);
    expect(decoded.operations[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it("upgrades an uncompressed legacy journal with deterministic sequences", async () => {
    const deviceId = testIds.next();
    const legacy = {
      format: "hafiza-sync",
      formatVersion: 1,
      deviceId,
      updatedAt: testInstant.toISOString(),
      operations: [
        {
          id: testIds.next(),
          entityType: "review",
          entityId: testIds.next(),
          operation: "upsert",
          occurredAt: testInstant.toISOString(),
          deviceId,
          status: "synced",
          payload: {},
        },
      ],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(legacy));

    const decoded = await decodeJournal(bytes.buffer);

    expect(decoded.formatVersion).toBe(2);
    expect(decoded.operations[0]?.sequence).toBe(1);
  });

  it("rejects corrupt journals", async () => {
    await expect(
      decodeJournal(new TextEncoder().encode("not-json").buffer),
    ).rejects.toThrow();
  });
});

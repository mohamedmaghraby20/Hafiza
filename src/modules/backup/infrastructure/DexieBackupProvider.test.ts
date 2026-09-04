import { afterEach, describe, expect, it } from "vitest";

import { DexieCardRepository } from "@modules/cards";
import { DexieDeckRepository } from "@modules/decks";
import { HafizaDatabase } from "@shared/infrastructure/database";
import {
  createCardFixture,
  createDeckFixture,
  testIds,
} from "@test/domainFixtures";

import { DexieBackupProvider } from "./DexieBackupProvider";

describe("DexieBackupProvider", () => {
  const databases: HafizaDatabase[] = [];

  afterEach(async () => {
    await Promise.all(databases.map((database) => database.delete()));
    databases.length = 0;
  });

  it("round-trips learning data through a validated backup", async () => {
    const source = new HafizaDatabase(`backup-source-${testIds.next()}`);
    const target = new HafizaDatabase(`backup-target-${testIds.next()}`);
    databases.push(source, target);
    const deck = createDeckFixture();
    const card = createCardFixture(deck.id);
    await new DexieDeckRepository(source).save(deck);
    await new DexieCardRepository(source).save(card);

    const exported = await new DexieBackupProvider(source).create();
    const serialized = JSON.stringify(exported);
    const targetBackup = new DexieBackupProvider(target);
    await targetBackup.restore(targetBackup.parse(serialized));

    expect(await new DexieDeckRepository(target).findById(deck.id)).toEqual(
      deck,
    );
    expect(await new DexieCardRepository(target).findById(card.id)).toEqual(
      card,
    );
  });

  it("rejects unknown formats before touching the database", () => {
    const database = new HafizaDatabase(`backup-invalid-${testIds.next()}`);
    databases.push(database);
    expect(() =>
      new DexieBackupProvider(database).parse('{"format":"other"}'),
    ).toThrow();
  });
});

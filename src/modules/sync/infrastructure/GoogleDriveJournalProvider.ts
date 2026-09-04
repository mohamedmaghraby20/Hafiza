import { z } from "zod";

import type { EntityId } from "@shared/index";

import type { RemoteJournalProvider, SyncJournal } from "../domain/SyncJournal";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const PREFIX = "hafiza-journal-";

const operationSchema = z.looseObject({
  id: z.string(),
  entityType: z.enum(["deck", "card", "tag", "folder", "review"]),
  entityId: z.string(),
  operation: z.enum(["upsert", "delete"]),
  occurredAt: z.string(),
  deviceId: z.string(),
  status: z.enum(["pending", "synced"]),
  payload: z.unknown(),
});

const journalSchema = z.discriminatedUnion("formatVersion", [
  z.object({
    format: z.literal("hafiza-sync"),
    formatVersion: z.literal(1),
    deviceId: z.string(),
    updatedAt: z.string(),
    operations: z.array(operationSchema),
  }),
  z.object({
    format: z.literal("hafiza-sync"),
    formatVersion: z.literal(2),
    deviceId: z.string(),
    updatedAt: z.string(),
    operations: z.array(
      operationSchema.extend({ sequence: z.number().int().positive() }),
    ),
  }),
]);

async function checked(response: Response): Promise<Response> {
  if (response.ok) return response;
  throw new Error(
    `Drive sync failed (${response.status}): ${await response.text()}`,
  );
}

function revive(value: unknown): SyncJournal {
  const journal = journalSchema.parse(value);
  const operations =
    journal.formatVersion === 2
      ? journal.operations.map((operation) => ({
          ...operation,
          sequence: operation.sequence,
        }))
      : journal.operations.map((operation, index) => ({
          ...operation,
          sequence: index + 1,
        }));
  return {
    format: "hafiza-sync",
    formatVersion: 2,
    deviceId: journal.deviceId as EntityId,
    updatedAt: journal.updatedAt,
    operations: operations.map((operation) => ({
      ...operation,
      id: operation.id as EntityId,
      entityId: operation.entityId as EntityId,
      deviceId: operation.deviceId as EntityId,
      occurredAt: new Date(operation.occurredAt),
    })),
  };
}

export async function encodeJournal(
  journal: SyncJournal,
): Promise<ArrayBuffer> {
  const json = JSON.stringify(journal);
  if (
    typeof CompressionStream === "undefined" ||
    typeof Blob.prototype.stream !== "function"
  ) {
    return new TextEncoder().encode(json).buffer;
  }
  return new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
}

export async function decodeJournal(buffer: ArrayBuffer): Promise<SyncJournal> {
  const bytes = new Uint8Array(buffer);
  const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (
    gzip &&
    (typeof DecompressionStream === "undefined" ||
      typeof Blob.prototype.stream !== "function")
  ) {
    throw new Error("This browser cannot decompress the Drive sync journal.");
  }
  const text = gzip
    ? await new Response(
        new Blob([buffer])
          .stream()
          .pipeThrough(new DecompressionStream("gzip")),
      ).text()
    : new TextDecoder().decode(bytes);
  return revive(JSON.parse(text));
}

export class GoogleDriveJournalProvider implements RemoteJournalProvider {
  async list(accessToken: string): Promise<readonly SyncJournal[]> {
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name contains '${PREFIX}' and trashed=false`,
      pageSize: "100",
      fields: "files(id,name)",
    });
    const response = await checked(
      await fetch(`${API}?${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    const payload = (await response.json()) as {
      files?: readonly { id: string }[];
    };
    return Promise.all(
      (payload.files ?? []).map(async ({ id }) => {
        const file = await checked(
          await fetch(`${API}/${id}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        );
        return decodeJournal(await file.arrayBuffer());
      }),
    );
  }

  async save(journal: SyncJournal, accessToken: string): Promise<void> {
    const name = `${PREFIX}${journal.deviceId}.json.gz`;
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name contains '${PREFIX}${journal.deviceId}' and trashed=false`,
      pageSize: "1",
      fields: "files(id)",
    });
    const list = await checked(
      await fetch(`${API}?${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    const existing = (
      (await list.json()) as { files?: readonly { id: string }[] }
    ).files?.[0]?.id;
    const boundary = `hafiza-${crypto.randomUUID()}`;
    const metadata = existing ? { name } : { name, parents: ["appDataFolder"] };
    const compressed = await encodeJournal(journal);
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
      compressed,
      `\r\n--${boundary}--`,
    ]);
    await checked(
      await fetch(
        existing
          ? `${UPLOAD}/${existing}?uploadType=multipart`
          : `${UPLOAD}?uploadType=multipart`,
        {
          method: existing ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      ),
    );
  }
}

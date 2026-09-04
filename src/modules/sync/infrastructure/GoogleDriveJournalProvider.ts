import { z } from "zod";

import type { EntityId } from "@shared/index";

import type { RemoteJournalProvider, SyncJournal } from "../domain/SyncJournal";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const PREFIX = "hafiza-journal-";

const journalSchema = z.object({
  format: z.literal("hafiza-sync"),
  formatVersion: z.literal(1),
  deviceId: z.string(),
  updatedAt: z.string(),
  operations: z.array(
    z.looseObject({
      id: z.string(),
      entityType: z.enum(["deck", "card", "tag", "folder", "review"]),
      entityId: z.string(),
      operation: z.enum(["upsert", "delete"]),
      occurredAt: z.string(),
      deviceId: z.string(),
      status: z.enum(["pending", "synced"]),
      payload: z.unknown(),
    }),
  ),
});

async function checked(response: Response): Promise<Response> {
  if (response.ok) return response;
  throw new Error(
    `Drive sync failed (${response.status}): ${await response.text()}`,
  );
}

function revive(journal: z.infer<typeof journalSchema>): SyncJournal {
  return {
    ...journal,
    deviceId: journal.deviceId as EntityId,
    operations: journal.operations.map((operation) => ({
      ...operation,
      id: operation.id as EntityId,
      entityId: operation.entityId as EntityId,
      deviceId: operation.deviceId as EntityId,
      occurredAt: new Date(operation.occurredAt),
    })),
  };
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
        return revive(journalSchema.parse(await file.json()));
      }),
    );
  }

  async save(journal: SyncJournal, accessToken: string): Promise<void> {
    const name = `${PREFIX}${journal.deviceId}.json`;
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name='${name}' and trashed=false`,
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
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(journal)}\r\n--${boundary}--`;
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

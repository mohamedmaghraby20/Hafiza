import { afterEach, describe, expect, it, vi } from "vitest";

import { GoogleDriveBackupProvider } from "./GoogleDriveBackupProvider";

describe("GoogleDriveBackupProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads a backup into the private app-data folder", async () => {
    let callCount = 0;
    let uploadedBody: BodyInit | null | undefined;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ files: [] }), { status: 200 }),
          );
        }
        uploadedBody = init?.body;
        return Promise.resolve(new Response("{}", { status: 200 }));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await new GoogleDriveBackupProvider().upload(
      '{"format":"hafiza"}',
      "token",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(typeof uploadedBody).toBe("string");
    expect(uploadedBody).toContain("appDataFolder");
  });

  it("downloads the latest backup file", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ files: [{ id: "file-1" }] }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(new Response("backup-content", { status: 200 })),
    );

    await expect(
      new GoogleDriveBackupProvider().downloadLatest("token"),
    ).resolves.toBe("backup-content");
  });
});

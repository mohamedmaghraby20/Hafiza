import type {
  AccessTokenProvider,
  RemoteBackupProvider,
} from "../application/RemoteBackupProvider";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FILE_NAME = "hafiza-latest.hafiza";

async function checked(response: Response): Promise<Response> {
  if (response.ok) return response;
  const detail = await response.text();
  throw new Error(
    `Google Drive request failed (${response.status}): ${detail}`,
  );
}

export class GoogleDriveBackupProvider implements RemoteBackupProvider {
  async upload(serialized: string, accessToken: string): Promise<void> {
    const existingId = await this.findLatestId(accessToken);
    const boundary = `hafiza-${crypto.randomUUID()}`;
    const metadata = existingId
      ? { name: FILE_NAME }
      : { name: FILE_NAME, parents: ["appDataFolder"] };
    const body = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
      serialized,
      `\r\n--${boundary}--`,
    ].join("");
    const endpoint = existingId
      ? `${DRIVE_UPLOAD}/${existingId}?uploadType=multipart`
      : `${DRIVE_UPLOAD}?uploadType=multipart`;
    await checked(
      await fetch(endpoint, {
        method: existingId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }),
    );
  }

  async downloadLatest(accessToken: string): Promise<string> {
    const id = await this.findLatestId(accessToken);
    if (!id) throw new Error("No Hafiza backup exists in Google Drive.");
    return (
      await checked(
        await fetch(`${DRIVE_API}/${id}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      )
    ).text();
  }

  private async findLatestId(accessToken: string): Promise<string | null> {
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name='${FILE_NAME}' and trashed=false`,
      orderBy: "modifiedTime desc",
      pageSize: "1",
      fields: "files(id)",
    });
    const response = await checked(
      await fetch(`${DRIVE_API}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    const payload = (await response.json()) as {
      files?: readonly { id?: string }[];
    };
    return payload.files?.[0]?.id ?? null;
  }
}

interface GoogleTokenResponse {
  readonly access_token?: string;
  readonly error?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleAccounts {
  readonly oauth2: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (response: GoogleTokenResponse) => void;
      error_callback: (error: unknown) => void;
    }): GoogleTokenClient;
    revoke(token: string, callback: () => void): void;
  };
}

declare global {
  interface Window {
    google?: { readonly accounts: GoogleAccounts };
  }
}

export class GoogleOAuthTokenProvider implements AccessTokenProvider {
  private token: string | null = null;

  constructor(private readonly clientId: string) {}

  request(): Promise<string> {
    if (!this.clientId) {
      return Promise.reject(
        new Error("Set VITE_GOOGLE_CLIENT_ID to enable Google Drive backup."),
      );
    }
    if (!window.google) {
      return Promise.reject(
        new Error("Google authorization is unavailable while offline."),
      );
    }
    return new Promise((resolve, reject) => {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: "https://www.googleapis.com/auth/drive.appdata",
        callback: (response) => {
          if (!response.access_token) {
            reject(
              new Error(
                response.error || "Google authorization was cancelled.",
              ),
            );
            return;
          }
          this.token = response.access_token;
          resolve(response.access_token);
        },
        error_callback: reject,
      });
      client.requestAccessToken({ prompt: "" });
    });
  }

  current(): string | null {
    return this.token;
  }

  revoke(): void {
    if (!this.token || !window.google) return;
    window.google.accounts.oauth2.revoke(this.token, () => undefined);
    this.token = null;
  }
}

export interface RemoteBackupProvider {
  upload(serialized: string, accessToken: string): Promise<void>;
  downloadLatest(accessToken: string): Promise<string>;
}

export interface AccessTokenProvider {
  request(): Promise<string>;
  current(): string | null;
  revoke(): void;
}

export class BackupCompressionWorkerClient {
  compress(text: string): Promise<ArrayBuffer> {
    return this.run<ArrayBuffer>({ kind: "compress", text });
  }

  decompress(buffer: ArrayBuffer): Promise<string> {
    return this.run<string>({ kind: "decompress", buffer });
  }

  private run<T>(
    input:
      | { kind: "compress"; text: string }
      | { kind: "decompress"; buffer: ArrayBuffer },
  ): Promise<T> {
    const worker = new Worker(
      new URL("./backupCompression.worker.ts", import.meta.url),
      { type: "module" },
    );
    return new Promise((resolve, reject) => {
      worker.addEventListener(
        "message",
        (event: MessageEvent<{ value: T }>) => {
          resolve(event.data.value);
          worker.terminate();
        },
      );
      worker.addEventListener("error", (event) => {
        reject(new Error(event.message || "Backup worker failed."));
        worker.terminate();
      });
      worker.postMessage(input);
    });
  }
}

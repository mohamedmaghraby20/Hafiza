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
        (
          event: MessageEvent<
            | { readonly ok: true; readonly value: T }
            | { readonly ok: false; readonly message: string }
          >,
        ) => {
          if (event.data.ok) resolve(event.data.value);
          else reject(new Error(event.data.message));
          worker.terminate();
        },
      );
      worker.addEventListener("messageerror", () => {
        reject(new Error("The backup worker returned unreadable data."));
        worker.terminate();
      });
      worker.addEventListener("error", (event) => {
        reject(new Error(event.message || "Backup worker failed."));
        worker.terminate();
      });
      worker.postMessage(input);
    });
  }
}

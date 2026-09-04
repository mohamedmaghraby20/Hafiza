import type { ImportPreview } from "../domain/ImportModel";

export class CsvImportWorkerClient {
  parse(fileName: string, content: string): Promise<ImportPreview> {
    return this.run({ kind: "csv", fileName, content });
  }

  parseXlsx(fileName: string, content: ArrayBuffer): Promise<ImportPreview> {
    return this.run({ kind: "xlsx", fileName, content });
  }

  private run(
    input:
      | { kind: "csv"; fileName: string; content: string }
      | { kind: "xlsx"; fileName: string; content: ArrayBuffer },
  ): Promise<ImportPreview> {
    const worker = new Worker(
      new URL("./csvImport.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    return new Promise((resolve, reject) => {
      worker.addEventListener(
        "message",
        (
          event: MessageEvent<
            | { readonly ok: true; readonly value: ImportPreview }
            | { readonly ok: false; readonly message: string }
          >,
        ) => {
          if (event.data.ok) resolve(event.data.value);
          else reject(new Error(event.data.message));
          worker.terminate();
        },
      );
      worker.addEventListener("messageerror", () => {
        reject(new Error("The import worker returned unreadable data."));
        worker.terminate();
      });
      worker.addEventListener("error", (event) => {
        reject(new Error(event.message || "CSV analysis worker failed."));
        worker.terminate();
      });
      worker.postMessage(input);
    });
  }
}

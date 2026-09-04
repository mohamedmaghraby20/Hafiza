import { CsvImportAdapter } from "./CsvImportAdapter";
import { XlsxImportAdapter } from "./XlsxImportAdapter";

self.addEventListener(
  "message",
  (
    event: MessageEvent<
      | { kind: "csv"; fileName: string; content: string }
      | { kind: "xlsx"; fileName: string; content: ArrayBuffer }
    >,
  ) => {
    const data = event.data;
    void (async () => {
      try {
        const value =
          data.kind === "csv"
            ? new CsvImportAdapter().parse(data.fileName, data.content)
            : await new XlsxImportAdapter().parse(data.fileName, data.content);
        self.postMessage({ ok: true, value });
      } catch (error: unknown) {
        self.postMessage({
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "The file could not be parsed.",
        });
      }
    })();
  },
);

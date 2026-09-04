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
    if (data.kind === "csv") {
      self.postMessage(
        new CsvImportAdapter().parse(data.fileName, data.content),
      );
      return;
    }
    void new XlsxImportAdapter()
      .parse(data.fileName, data.content)
      .then((preview) => self.postMessage(preview));
  },
);

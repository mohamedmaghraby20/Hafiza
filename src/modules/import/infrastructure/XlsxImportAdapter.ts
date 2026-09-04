import { readSheet } from "read-excel-file/web-worker";

import type {
  ImportCard,
  ImportIssue,
  ImportPreview,
} from "../domain/ImportModel";

export class XlsxImportAdapter {
  async parse(fileName: string, content: ArrayBuffer): Promise<ImportPreview> {
    const rows = await readSheet(content);
    const headers = (rows[0] ?? []).map((value) =>
      String(value ?? "")
        .trim()
        .toLocaleLowerCase(),
    );
    const frontIndex = headers.findIndex((value) =>
      ["front", "question", "prompt"].includes(value),
    );
    const backIndex = headers.findIndex((value) =>
      ["back", "answer"].includes(value),
    );
    const tagIndex = headers.findIndex((value) => value === "tags");
    const cards: ImportCard[] = [];
    const issues: ImportIssue[] = [];
    if (frontIndex < 0 || backIndex < 0) {
      return {
        fileName,
        cards,
        issues: [
          {
            row: 1,
            message: "Workbook needs Front/Back or Question/Answer columns.",
          },
        ],
      };
    }
    rows.slice(1).forEach((row, index) => {
      const front = String(row[frontIndex] ?? "").trim();
      const back = String(row[backIndex] ?? "").trim();
      if (!front || !back) {
        issues.push({
          row: index + 2,
          message: "Question and answer are required.",
        });
        return;
      }
      cards.push({
        front,
        back,
        tags:
          tagIndex < 0
            ? []
            : String(row[tagIndex] ?? "")
                .split(/[;|]/)
                .map((tag) => tag.trim())
                .filter(Boolean),
        row: index + 2,
      });
    });
    return { fileName, cards, issues };
  }
}

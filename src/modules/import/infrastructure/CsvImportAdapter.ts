import type {
  ImportAdapter,
  ImportCard,
  ImportIssue,
  ImportPreview,
} from "../domain/ImportModel";

function parseLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
}

export class CsvImportAdapter implements ImportAdapter {
  parse(fileName: string, content: string): ImportPreview {
    const lines = content
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    const header = parseLine(lines[0] ?? "").map((value) =>
      value.toLocaleLowerCase(),
    );
    const frontIndex = header.findIndex((value) =>
      ["front", "question", "prompt"].includes(value),
    );
    const backIndex = header.findIndex((value) =>
      ["back", "answer"].includes(value),
    );
    const tagIndex = header.findIndex((value) => value === "tags");
    const cards: ImportCard[] = [];
    const issues: ImportIssue[] = [];
    if (frontIndex < 0 || backIndex < 0) {
      return {
        fileName,
        cards,
        issues: [
          {
            row: 1,
            message: "CSV needs Front/Back or Question/Answer columns.",
          },
        ],
      };
    }
    for (let index = 1; index < lines.length; index += 1) {
      const values = parseLine(lines[index]!);
      const front = values[frontIndex]?.trim() ?? "";
      const back = values[backIndex]?.trim() ?? "";
      if (!front || !back) {
        issues.push({
          row: index + 1,
          message: "Question and answer are required.",
        });
        continue;
      }
      cards.push({
        front,
        back,
        tags:
          tagIndex < 0
            ? []
            : (values[tagIndex] ?? "")
                .split(/[;|]/)
                .map((tag) => tag.trim())
                .filter(Boolean),
        row: index + 1,
      });
    }
    return { fileName, cards, issues };
  }
}

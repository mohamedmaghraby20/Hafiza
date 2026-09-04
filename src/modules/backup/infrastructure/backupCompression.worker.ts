async function compress(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

async function decompress(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    return new TextDecoder().decode(bytes);
  }
  const stream = new Blob([buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

self.addEventListener(
  "message",
  (
    event: MessageEvent<
      | { kind: "compress"; text: string }
      | { kind: "decompress"; buffer: ArrayBuffer }
    >,
  ) => {
    const task =
      event.data.kind === "compress"
        ? compress(event.data.text)
        : decompress(event.data.buffer);
    void task.then(
      (value) => self.postMessage({ ok: true, value }),
      (error: unknown) =>
        self.postMessage({
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "Backup processing failed.",
        }),
    );
  },
);

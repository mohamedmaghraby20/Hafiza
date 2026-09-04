let measurementSequence = 0;

export async function measureOperation<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof performance === "undefined") return operation();
  measurementSequence += 1;
  const key = `${name}-${measurementSequence}`;
  const start = `${key}-start`;
  const end = `${key}-end`;
  performance.mark(start);
  try {
    return await operation();
  } finally {
    performance.mark(end);
    performance.measure(name, start, end);
    performance.clearMarks(start);
    performance.clearMarks(end);
  }
}

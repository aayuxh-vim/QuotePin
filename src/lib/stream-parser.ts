export async function parseDataStream(
  body: ReadableStream<Uint8Array>,
  onText: (accumulated: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep the last (possibly incomplete) line in the buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // AI SDK v4 data stream: text chunks are "0:" prefixed
      if (trimmed.startsWith("0:")) {
        try {
          const parsed = JSON.parse(trimmed.slice(2));
          if (typeof parsed === "string") {
            fullText += parsed;
            onText(fullText);
          }
        } catch {
          // not valid JSON yet, skip
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("0:")) {
      try {
        const parsed = JSON.parse(trimmed.slice(2));
        if (typeof parsed === "string") {
          fullText += parsed;
          onText(fullText);
        }
      } catch {
        // skip
      }
    }
  }

  return fullText;
}

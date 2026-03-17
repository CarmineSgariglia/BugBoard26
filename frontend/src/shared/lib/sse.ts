export type SseMessage = {
  event: string;
  data: string;
  id?: string;
};

type MutableSseMessage = {
  event?: string;
  dataLines: string[];
  id?: string;
};

function buildSseMessage(message: MutableSseMessage): SseMessage | null {
  if (!message.event && message.dataLines.length === 0 && !message.id) {
    return null;
  }

  return {
    event: message.event ?? "message",
    data: message.dataLines.join("\n"),
    id: message.id,
  };
}

export function createSseParser(onMessage: (message: SseMessage) => void) {
  let buffer = "";
  let message: MutableSseMessage = { dataLines: [] };

  const flushMessage = () => {
    const built = buildSseMessage(message);
    message = { dataLines: [] };
    if (built) {
      onMessage(built);
    }
  };

  return (chunk: string) => {
    buffer += chunk;

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) {
        flushMessage();
        continue;
      }

      if (line.startsWith(":")) {
        continue;
      }

      const separatorIndex = line.indexOf(":");
      const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
      const rawValue = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).replace(/^ /, "");

      switch (field) {
        case "event":
          message.event = rawValue;
          break;
        case "data":
          message.dataLines.push(rawValue);
          break;
        case "id":
          message.id = rawValue;
          break;
        default:
          break;
      }
    }
  };
}

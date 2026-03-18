import { describe, expect, it, vi } from "vitest";

import { createSseParser } from "@shared/lib/sse";

describe("createSseParser", () => {
  it("parses event, id and multiline data across chunks", () => {
    const onMessage = vi.fn();
    const parse = createSseParser(onMessage);

    parse("event: issue.updated\nid: 42\ndata: first line\n");
    parse("data: second line\n\n");

    expect(onMessage).toHaveBeenCalledWith({
      event: "issue.updated",
      id: "42",
      data: "first line\nsecond line",
    });
  });

  it("ignores comments and uses the default message event", () => {
    const onMessage = vi.fn();
    const parse = createSseParser(onMessage);

    parse(":keep-alive\ndata: hello\n\n");

    expect(onMessage).toHaveBeenCalledWith({
      event: "message",
      data: "hello",
      id: undefined,
    });
  });

  it("does not emit an empty message on blank separators", () => {
    const onMessage = vi.fn();
    const parse = createSseParser(onMessage);

    parse("\n");

    expect(onMessage).not.toHaveBeenCalled();
  });
});

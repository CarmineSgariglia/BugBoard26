import { expect } from "vitest";

expect.extend({
  toBeInTheDocument(received: unknown) {
    const pass =
      received instanceof Node &&
      received.ownerDocument?.documentElement.contains(received) === true;

    return {
      pass,
      message: () =>
        pass
          ? "Expected element not to be present in the document"
          : "Expected element to be present in the document",
    };
  },

  toHaveAttribute(received: unknown, name: string, value?: string) {
    const element = received as Element | null;
    const hasAttribute = !!element?.hasAttribute?.(name);
    const actualValue = element?.getAttribute?.(name);
    const pass = value === undefined ? hasAttribute : actualValue === value;

    return {
      pass,
      message: () =>
        value === undefined
          ? pass
            ? `Expected element not to have attribute "${name}"`
            : `Expected element to have attribute "${name}"`
          : pass
            ? `Expected element not to have attribute "${name}" with value "${value}"`
            : `Expected element to have attribute "${name}" with value "${value}", received "${actualValue}"`
    };
  },

  toHaveTextContent(received: unknown, expected: string | RegExp) {
    const textContent = (received as Node | null)?.textContent ?? "";
    const pass =
      expected instanceof RegExp ? expected.test(textContent) : textContent.includes(expected);

    return {
      pass,
      message: () =>
        pass
          ? `Expected element text not to match "${String(expected)}"`
          : `Expected element text to match "${String(expected)}", received "${textContent}"`,
    };
  },

  toHaveValue(received: unknown, expected: string | number | string[]) {
    const element = received as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    const actualValue = element?.value;
    const pass = Array.isArray(expected)
      ? Array.isArray(actualValue) && expected.length === actualValue.length
      : actualValue === String(expected);

    return {
      pass,
      message: () =>
        pass
          ? `Expected element not to have value "${String(expected)}"`
          : `Expected element to have value "${String(expected)}", received "${String(actualValue)}"`,
    };
  },
});

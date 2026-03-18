import { describe, expect, it, vi } from "vitest";
import { getFieldError, getErrorMessage } from "../../../../src/shared/lib/error";
import axios from "axios";

vi.mock("axios");

describe("error helpers", () => {
  describe("getFieldError", () => {
    it("returns null if not an axios error", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(false);
      expect(getFieldError(new Error("Generic"), "username")).toBeNull();
    });

    it("extracts string message from error field", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      const mockError = {
        response: { data: { username: "Already taken" } }
      };
      expect(getFieldError(mockError, "username")).toBe("Already taken");
    });

    it("extracts nested array message", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      const mockError = {
        response: { data: { username: ["Too short", "Invalid chars"] } }
      };
      expect(getFieldError(mockError, "username")).toBe("Too short");
    });

    it("returns null when the field is missing or the payload is not an object", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      expect(getFieldError({ response: { data: null } }, "username")).toBeNull();
      expect(getFieldError({ response: { data: { email: "Wrong field" } } }, "username")).toBeNull();
    });
  });

  describe("getErrorMessage", () => {
    it("returns fallback if not axios error", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(false);
      expect(getErrorMessage(new Error(), "Fallback")).toBe("Fallback");
    });

    it("returns prioritized key like detail", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      const mockError = {
        response: { data: { detail: "Auth required", non_field_errors: "Ignored" } }
      };
      expect(getErrorMessage(mockError, "Fallback")).toBe("Auth required");
    });

    it("handles deeply nested object values", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      const mockError = {
        response: { data: { errors: { foo: { bar: "Deep error" } } } }
      };
      expect(getErrorMessage(mockError, "Fallback")).toBe("Deep error");
    });

    it("prefers non_field_errors and password-related keys when present", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      expect(
        getErrorMessage(
          { response: { data: { non_field_errors: ["General error"], email: "Ignored" } } },
          "Fallback"
        )
      ).toBe("General error");

      expect(
        getErrorMessage(
          { response: { data: { currentPassword: ["Wrong current password"] } } },
          "Fallback"
        )
      ).toBe("Wrong current password");
    });

    it("returns the fallback when no readable message exists", () => {
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      expect(getErrorMessage({ response: { data: {} } }, "Fallback")).toBe("Fallback");
    });
  });
});

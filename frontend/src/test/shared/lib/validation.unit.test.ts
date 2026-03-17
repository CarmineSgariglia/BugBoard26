import {
  isValidCode,
  isValidEmail,
  isValidName,
  isValidPassword,
} from "@shared/lib/validation";

describe("validation helpers", () => {
  it("accepts a syntactically valid email and rejects malformed input", () => {
    expect(isValidEmail(" dev@test.it ")).toBe(true);
    expect(isValidEmail("bad")).toBe(false);
    expect(isValidEmail("a@b.c")).toBe(false);
  });

  it("accepts names with letters and spaces only", () => {
    expect(isValidName("Mario Rossi")).toBe(true);
    expect(isValidName("Al")).toBe(false);
    expect(isValidName("Mario123")).toBe(false);
  });

  it("requires a six digit code", () => {
    expect(isValidCode("123456")).toBe(true);
    expect(isValidCode("12345")).toBe(false);
    expect(isValidCode("12345a")).toBe(false);
  });

  it("requires password length, number and special character", () => {
    expect(isValidPassword("Strong123!")).toBe(true);
    expect(isValidPassword("weakpass")).toBe(false);
    expect(isValidPassword("NoSpecial1")).toBe(false);
    expect(isValidPassword("!NoNumber")).toBe(false);
  });
});

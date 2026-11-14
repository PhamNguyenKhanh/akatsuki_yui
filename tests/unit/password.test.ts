import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("Password Hashing Utilities", () => {
  it("hashes password securely using bcrypt and verifies correctly", async () => {
    const plain = "Akatsuki@2026";
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);

    expect(hash1).not.toBe(plain);
    expect(hash1.startsWith("$2")).toBe(true);
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(plain, hash1)).toBe(true);
    expect(await verifyPassword("WrongPassword@2026", hash1)).toBe(false);
  });
});

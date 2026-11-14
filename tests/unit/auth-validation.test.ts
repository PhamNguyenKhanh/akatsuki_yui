import { describe, expect, it } from "vitest";
import { passwordPolicySchema } from "@/lib/validations/common";
import { loginSchema, registerSchema } from "@/modules/auth/auth.schema";
import {
  changePasswordSchema,
  updateProfileSchema,
  userListQuerySchema,
} from "@/modules/users/user.schema";

describe("DEC-013 Password Policy & Auth Schemas", () => {
  it("accepts strong passwords meeting all complexity requirements", () => {
    expect(passwordPolicySchema.safeParse("StrongPass@123").success).toBe(true);
    expect(passwordPolicySchema.safeParse("Akatsuki#2026!").success).toBe(true);
  });

  it("rejects weak passwords violating DEC-013 rules", () => {
    expect(passwordPolicySchema.safeParse("Ab1@").success).toBe(false); // < 8 chars
    expect(passwordPolicySchema.safeParse("lowercase1@").success).toBe(false); // no uppercase
    expect(passwordPolicySchema.safeParse("UPPERCASE1@").success).toBe(false); // no lowercase
    expect(passwordPolicySchema.safeParse("NoDigitsHere@").success).toBe(false); // no digit
    expect(passwordPolicySchema.safeParse("NoSpecial123").success).toBe(false); // no special char
  });

  it("validates registerSchema and normalizes email to lowercase", () => {
    const parsed = registerSchema.parse({
      fullName: "  Nguyen Van A  ",
      email: "  Member.Test@Example.COM  ",
      password: "Password@123",
      confirmPassword: "Password@123",
    });

    expect(parsed.fullName).toBe("Nguyen Van A");
    expect(parsed.email).toBe("member.test@example.com");
  });

  it("rejects mismatched confirmPassword in registerSchema", () => {
    const result = registerSchema.safeParse({
      fullName: "Nguyen Van A",
      email: "member@example.com",
      password: "Password@123",
      confirmPassword: "Password@124",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(
        true
      );
    }
  });

  it("validates loginSchema and normalizes email", () => {
    const parsed = loginSchema.parse({
      email: "USER@EXAMPLE.COM",
      password: "any-password",
    });
    expect(parsed.email).toBe("user@example.com");
  });

  it("enforces DEC-018 strict fullName-only profile updates", () => {
    expect(updateProfileSchema.safeParse({ fullName: "Tran Thi B" }).success).toBe(true);
    expect(
      updateProfileSchema.safeParse({ fullName: "Tran Thi B", email: "hack@example.com" }).success
    ).toBe(false);
    expect(updateProfileSchema.safeParse({ fullName: "Tran Thi B", role: "ADMIN" }).success).toBe(
      false
    );
  });

  it("enforces password complexity and difference rules in changePasswordSchema", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "OldPassword@1",
        newPassword: "NewPassword@2",
        confirmNewPassword: "NewPassword@2",
      }).success
    ).toBe(true);

    expect(
      changePasswordSchema.safeParse({
        currentPassword: "SamePassword@1",
        newPassword: "SamePassword@1",
        confirmNewPassword: "SamePassword@1",
      }).success
    ).toBe(false);
  });

  it("parses pagination and filters in userListQuerySchema", () => {
    const parsed = userListQuerySchema.parse({
      page: "2",
      pageSize: "20",
      status: "PENDING",
      role: "MEMBER",
      search: "  an  ",
    });

    expect(parsed).toEqual({
      page: 2,
      pageSize: 20,
      status: "PENDING",
      role: "MEMBER",
      search: "an",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });
});

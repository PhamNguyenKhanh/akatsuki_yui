import "server-only";
import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/lib/auth";
import {
  forbiddenError,
  rateLimitExceededError,
  serviceUnavailableError,
  unauthorizedError,
} from "@/lib/errors";
import { executeWithLoginRateLimit } from "@/lib/rate-limit";
import { loginSchema, type LoginInput } from "@/modules/auth/auth.schema";
import { mapUserToSafeDTO, userRepository } from "@/modules/users/user.repository";
import type { SafeUserDTO } from "@/types/auth";

function mapAuthErrorCodeToAppError(code?: string) {
  switch (code) {
    case "ACCOUNT_PENDING":
      return forbiddenError("Tài khoản đang chờ Admin phê duyệt.", "ACCOUNT_PENDING");
    case "ACCOUNT_REJECTED":
      return forbiddenError("Tài khoản đã bị từ chối.", "ACCOUNT_REJECTED");
    case "ACCOUNT_SUSPENDED":
      return forbiddenError("Tài khoản đã bị tạm khóa.", "ACCOUNT_SUSPENDED");
    case "RATE_LIMIT_EXCEEDED":
      return rateLimitExceededError(
        "Bạn đã thao tác đăng nhập quá nhiều lần. Vui lòng thử lại sau."
      );
    case "SERVICE_UNAVAILABLE":
      return serviceUnavailableError();
    default:
      return unauthorizedError("Email hoặc mật khẩu không chính xác.", "INVALID_CREDENTIALS");
  }
}

function extractCredentialsErrorCode(error: unknown): string | undefined {
  if (error instanceof CredentialsSignin) {
    return error.code;
  }
  if (error instanceof AuthError && error.type === "CredentialsSignin") {
    const maybeWithCode = error as AuthError & { code?: string };
    return maybeWithCode.code;
  }
  return undefined;
}

export async function performCredentialsLogin(
  rawInput: LoginInput,
  options?: { headers?: Headers | null }
): Promise<{ user: SafeUserDTO }> {
  const input = loginSchema.parse(rawInput);

  await executeWithLoginRateLimit(
    { email: input.email, headers: options?.headers },
    async () => {
      try {
        await signIn("credentials", {
          email: input.email,
          password: input.password,
          redirect: false,
        });
      } catch (error) {
        if (error instanceof CredentialsSignin || error instanceof AuthError) {
          throw mapAuthErrorCodeToAppError(extractCredentialsErrorCode(error));
        }
        throw error;
      }
    }
  );

  const user = await userRepository.findByEmail(input.email);
  if (!user) {
    throw unauthorizedError("Email hoặc mật khẩu không chính xác.", "INVALID_CREDENTIALS");
  }

  return { user: mapUserToSafeDTO(user) };
}

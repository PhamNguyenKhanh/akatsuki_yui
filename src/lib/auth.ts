import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { isAppError } from "@/lib/errors";
import { authConfig } from "@/lib/auth.config";
import { executeWithLoginRateLimit } from "@/lib/rate-limit";
import { authenticateCredentials } from "@/modules/auth/auth.service";

export class CredentialsAuthCodeError extends CredentialsSignin {
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const reqHeaders = request instanceof Request ? request.headers : undefined;

        try {
          const authenticated = await executeWithLoginRateLimit(
            { email, headers: reqHeaders },
            () => authenticateCredentials({ email, password })
          );

          return {
            id: authenticated.id,
            email: authenticated.email,
            name: authenticated.fullName,
            roles: authenticated.roles,
            tokenVersion: authenticated.tokenVersion,
          };
        } catch (error) {
          if (isAppError(error)) {
            throw new CredentialsAuthCodeError(error.code);
          }
          throw new CredentialsAuthCodeError("INVALID_CREDENTIALS");
        }
      },
    }),
  ],
});

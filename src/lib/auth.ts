import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { isAppError } from "@/lib/errors";
import { authConfig } from "@/lib/auth.config";
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
      async authorize(credentials) {
        try {
          const authenticated = await authenticateCredentials({
            email: typeof credentials?.email === "string" ? credentials.email : "",
            password: typeof credentials?.password === "string" ? credentials.password : "",
          });

          return {
            id: authenticated.id,
            email: authenticated.email,
            name: authenticated.fullName,
            roles: authenticated.roles,
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

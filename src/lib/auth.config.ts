import type { NextAuthConfig } from "next-auth";
import type { RoleName } from "@/modules/authorization/constants";

export const AUTH_ROUTES = ["/login", "/register"] as const;
export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/pending-approval",
  "/access-denied",
] as const;
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/profile",
  "/admin",
  "/projects",
  "/documents",
  "/notifications",
  "/reports",
  "/activity",
] as const;

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
        token.roles = user.roles ?? [];
        token.tokenVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? token.sub ?? "";
        session.user.email = token.email ?? "";
        session.user.name = token.name ?? "";
        session.user.roles = (token.roles as RoleName[] | undefined) ?? [];
        session.user.tokenVersion =
          typeof token.tokenVersion === "number" ? token.tokenVersion : -1;
      }
      return session;
    },
  },
};

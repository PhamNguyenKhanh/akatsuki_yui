import type { DefaultSession } from "next-auth";
import type { RoleName } from "@/modules/authorization/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      roles: RoleName[];
      tokenVersion?: number;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    name?: string | null;
    roles?: RoleName[];
    tokenVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    roles?: RoleName[];
    tokenVersion?: number;
  }
}

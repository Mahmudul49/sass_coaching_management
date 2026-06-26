import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/db/collections";

/**
 * Shape of the data we put on the session/JWT. tenantId is null for superadmin.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tenantId: string | null;
      centerName: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role: Role;
    tenantId: string | null;
    centerName: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
    tenantId: string | null;
    centerName: string | null;
  }
}

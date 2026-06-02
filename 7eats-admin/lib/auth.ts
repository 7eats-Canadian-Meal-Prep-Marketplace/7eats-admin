import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@/db/schema/auth";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "client", required: false },
        status: { type: "string", defaultValue: "active", required: false },
        firstName: { type: "string", required: false },
        lastName: { type: "string", required: false },
        phone: { type: "string", required: false },
        phoneVerified: {
          type: "boolean",
          defaultValue: false,
          required: false,
        },
      },
    },
    secret,
    baseURL: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001",
    trustedOrigins: [
      process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001",
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ],
  });
}

type AuthType = ReturnType<typeof createAuth>;

let _auth: AuthType | undefined;

function getAuth(): AuthType {
  if (!_auth) _auth = createAuth();
  return _auth;
}

export const auth = new Proxy({} as AuthType, {
  get(_target, prop: string | symbol) {
    const instance = getAuth();
    const value = (instance as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
  has(_target, prop: string | symbol) {
    const instance = getAuth();
    return prop in (instance as object);
  },
});

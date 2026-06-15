// Edge-safe JWT helpers (jose only — no next/headers import, so middleware can
// use this on the edge runtime). The SECRET_KEY must match the API's.

import { jwtVerify } from "jose";

import type { Role } from "@/lib/types";

export interface TokenPayload {
  sub: string;
  type: "access" | "refresh";
  role: Role;
  provider_id: number | null;
  learner_id: number | null;
  site_id: number | null;
  exp: number;
}

function secret(): Uint8Array {
  const value = process.env.SECRET_KEY;
  if (!value) throw new Error("SECRET_KEY is not set");
  return new TextEncoder().encode(value);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Which sidebar nav items each role may see (spec §1.2).
export const NAV_VISIBILITY: Record<string, Role[]> = {
  dashboard: ["super_admin", "auditor", "provider_admin", "provider_verifier", "provider_payroll", "mentor"],
  learners: ["super_admin", "auditor", "provider_admin", "provider_verifier", "provider_payroll", "mentor"],
  attendance: ["super_admin", "auditor", "provider_admin", "provider_verifier", "mentor"],
  stipends: ["super_admin", "auditor", "provider_admin", "provider_payroll"],
  programmes: ["super_admin", "auditor", "provider_admin"],
  sites: ["super_admin", "auditor", "provider_admin"],
  providers: ["super_admin", "auditor"],
  admin: ["super_admin"],
};

export function canSee(item: string, role: Role): boolean {
  return NAV_VISIBILITY[item]?.includes(role) ?? false;
}

// Roles that operate across all providers rather than being scoped to one
// (mirrors backend app/deps.py is_cross_provider).
export function isCrossProviderRole(role: Role): boolean {
  return role === "super_admin" || role === "auditor";
}

// Mirrors backend app/models/enums.py Role.ALL.
export const ALL_ROLES: Role[] = [
  "super_admin",
  "auditor",
  "provider_admin",
  "provider_verifier",
  "provider_payroll",
  "mentor",
  "learner",
];

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { api, ApiError } from "@/lib/api";

export interface LoginState {
  error?: string;
}

const ACCESS_MAX_AGE = 8 * 60 * 60; // 8h
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30d

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "");

  if (!username || !password) {
    return { error: "Enter your username and password." };
  }

  let tokens;
  try {
    tokens = await api.auth.login(username, password);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Unable to reach the server. Please try again." };
  }

  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const common = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
  store.set("access_token", tokens.access_token, { ...common, maxAge: ACCESS_MAX_AGE });
  store.set("refresh_token", tokens.refresh_token, { ...common, maxAge: REFRESH_MAX_AGE });

  // redirect throws — must be outside the try/catch above.
  redirect(nextPath.startsWith("/") ? nextPath : "/dashboard");
}

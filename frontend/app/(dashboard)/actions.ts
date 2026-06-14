"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { api, ApiError } from "@/lib/api";
import type { Attendance, HeatmapDay, SiteHeadcount } from "@/lib/types";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof ApiError) return { ok: false, error: err.message };
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete("access_token");
  store.delete("refresh_token");
  redirect("/login");
}

// Polled by the SiteRail every 60s (spec §4.2).
export async function fetchSiteHeadcounts(): Promise<SiteHeadcount[]> {
  try {
    return await api.dashboard.sites();
  } catch {
    return [];
  }
}

// Drives the heatmap's month navigation arrows (spec §4.5).
export async function fetchHeatmap(year: number, month: number): Promise<HeatmapDay[]> {
  try {
    return await api.dashboard.heatmap(year, month);
  } catch {
    return [];
  }
}

export async function checkInLearner(input: {
  learner_id: number;
  latitude: number;
  longitude: number;
  override?: boolean;
  signature_data?: string;
}): Promise<ActionResult<Attendance>> {
  try {
    const data = await api.attendance.checkIn(input);
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function verifyAttendance(
  ids: number[],
  status: "verified" | "rejected",
): Promise<ActionResult<{ updated: number }>> {
  try {
    const data = await api.attendance.bulkVerify(ids, status);
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export interface CreateLearnerState {
  error?: string;
}

export async function createLearner(
  _prev: CreateLearnerState,
  formData: FormData,
): Promise<CreateLearnerState> {
  const get = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? undefined : v;
  };
  const id_number = get("id_number");
  if (!get("first_name") || !get("last_name") || !id_number) {
    return { error: "First name, last name and ID number are required." };
  }
  if (id_number.length !== 13) {
    return { error: "SA ID number must be 13 digits." };
  }

  let createdId: number;
  try {
    const learner = await api.learners.create({
      first_name: get("first_name"),
      last_name: get("last_name"),
      id_number,
      email: get("email"),
      phone: get("phone"),
      site_id: get("site_id") ? Number(get("site_id")) : null,
      programme_id: get("programme_id") ? Number(get("programme_id")) : null,
      stipend_rate_per_day: get("stipend_rate_per_day") ? Number(get("stipend_rate_per_day")) : 0,
    });
    createdId = learner.id;
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Could not create the learner. Please try again." };
  }
  revalidatePath("/learners");
  redirect(`/learners/${createdId}`);
}

export async function setLearnerStatus(
  id: number,
  status: string,
): Promise<ActionResult<{ id: number }>> {
  try {
    await api.learners.setStatus(id, status);
    revalidatePath("/learners");
    revalidatePath(`/learners/${id}`);
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err);
  }
}

export async function runStipendBatch(): Promise<ActionResult<{ id: number }>> {
  try {
    const batch = await api.stipends.run({});
    revalidatePath("/stipends");
    return { ok: true, data: { id: batch.id } };
  } catch (err) {
    return fail(err);
  }
}

export async function confirmStipendBatch(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await api.stipends.confirm(id);
    revalidatePath("/stipends");
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err);
  }
}

export async function payStipendBatch(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await api.stipends.pay(id);
    revalidatePath("/stipends");
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err);
  }
}

// Returns the CSV text so the client can stream it as a download (the auth
// cookie lives on this origin, so the browser can't fetch the API directly).
export async function downloadBatchCsv(id: number): Promise<ActionResult<string>> {
  try {
    const data = await api.stipends.csv(id);
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

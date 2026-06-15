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

export interface FormState {
  error?: string;
}

function getStr(formData: FormData, key: string): string | undefined {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? undefined : v;
}

export async function createProgramme(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = getStr(formData, "name");
  if (!name) return { error: "Name is required." };
  try {
    await api.programmes.create({
      name,
      sector: getStr(formData, "sector"),
      start_date: getStr(formData, "start_date"),
      end_date: getStr(formData, "end_date"),
      provider_id: getStr(formData, "provider_id") ? Number(getStr(formData, "provider_id")) : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Could not create the programme. Please try again." };
  }
  revalidatePath("/programmes");
  return {};
}

export async function createSite(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = getStr(formData, "name");
  const latitude = getStr(formData, "latitude");
  const longitude = getStr(formData, "longitude");
  if (!name || !latitude || !longitude) return { error: "Name, latitude and longitude are required." };
  try {
    await api.sites.create({
      name,
      address: getStr(formData, "address"),
      latitude: Number(latitude),
      longitude: Number(longitude),
      geofence_radius_meters: getStr(formData, "geofence_radius_meters")
        ? Number(getStr(formData, "geofence_radius_meters"))
        : 150,
      provider_id: getStr(formData, "provider_id") ? Number(getStr(formData, "provider_id")) : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Could not create the site. Please try again." };
  }
  revalidatePath("/sites");
  return {};
}

export async function createProvider(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = getStr(formData, "name");
  if (!name) return { error: "Name is required." };
  try {
    await api.providers.create({
      name,
      registration_number: getStr(formData, "registration_number"),
      contact_email: getStr(formData, "contact_email"),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Could not create the provider. Please try again." };
  }
  revalidatePath("/providers");
  return {};
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = getStr(formData, "username");
  const password = getStr(formData, "password");
  const role = getStr(formData, "role");
  if (!username || !password || !role) return { error: "Username, password and role are required." };
  try {
    await api.users.create({
      username,
      password,
      role,
      full_name: getStr(formData, "full_name"),
      provider_id: getStr(formData, "provider_id") ? Number(getStr(formData, "provider_id")) : undefined,
      site_id: getStr(formData, "site_id") ? Number(getStr(formData, "site_id")) : undefined,
      learner_id: getStr(formData, "learner_id") ? Number(getStr(formData, "learner_id")) : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Could not create the user. Please try again." };
  }
  revalidatePath("/admin");
  return {};
}

export async function updateUser(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const data: Record<string, unknown> = {};
  const password = getStr(formData, "password");
  const role = getStr(formData, "role");
  const fullName = getStr(formData, "full_name");
  const providerId = getStr(formData, "provider_id");
  const siteId = getStr(formData, "site_id");
  if (password) data.password = password;
  if (role) data.role = role;
  if (fullName) data.full_name = fullName;
  if (providerId) data.provider_id = Number(providerId);
  if (siteId) data.site_id = Number(siteId);
  try {
    await api.users.update(id, data);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Could not update the user. Please try again." };
  }
  revalidatePath("/admin");
  return {};
}

export async function deleteUser(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    await api.users.remove(id);
    revalidatePath("/admin");
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err);
  }
}

export async function updateLearner(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const data: Record<string, unknown> = {};
  const first_name = getStr(formData, "first_name");
  const last_name = getStr(formData, "last_name");
  const email = getStr(formData, "email");
  const phone = getStr(formData, "phone");
  const site_id = getStr(formData, "site_id");
  const programme_id = getStr(formData, "programme_id");
  const rate = getStr(formData, "stipend_rate_per_day");
  if (first_name) data.first_name = first_name;
  if (last_name) data.last_name = last_name;
  data.email = email ?? null;
  data.phone = phone ?? null;
  data.site_id = site_id ? Number(site_id) : null;
  data.programme_id = programme_id ? Number(programme_id) : null;
  if (rate) data.stipend_rate_per_day = Number(rate);
  try {
    await api.learners.update(id, data);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Could not update the learner. Please try again." };
  }
  revalidatePath(`/learners/${id}`);
  revalidatePath("/learners");
  redirect(`/learners/${id}`);
}

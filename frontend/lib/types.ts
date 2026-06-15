// TypeScript mirrors of the FastAPI response shapes. Keep in sync with
// backend/app/schemas/*. Status string unions mirror app/models/enums.py.

export type Role =
  | "super_admin"
  | "auditor"
  | "provider_admin"
  | "provider_verifier"
  | "provider_payroll"
  | "mentor"
  | "learner";

export type LearnerStatus = "active" | "inactive" | "suspended" | "deleted";
export type VerificationStatus = "pending" | "verified" | "rejected";
export type GeofenceResult = "inside" | "outside" | "rejected";
export type BatchStatus = "draft" | "confirmed" | "paid";
export type PaymentStatus = "pending" | "paid";
export type SiteStatus = "ok" | "warn" | "crit";
export type HeatIntensity = "low" | "moderate" | "good" | "full" | "weekend";

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  role: Role;
  provider_id: number | null;
  learner_id: number | null;
  site_id: number | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface BankDetails {
  id: number;
  account_holder: string | null;
  bank_name: string | null;
  account_number_last4: string | null;
  branch_code: string | null;
  verification_status: VerificationStatus;
}

export interface Learner {
  id: number;
  provider_id: number;
  site_id: number | null;
  site_name: string | null;
  programme_id: number | null;
  programme_name: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  id_number: string;
  email: string | null;
  phone: string | null;
  status: LearnerStatus;
  stipend_rate_per_day: number;
  bank_details_status: VerificationStatus;
}

export interface LearnerDetail extends Learner {
  enrolment_date: string | null;
  bank_details: BankDetails | null;
}

export interface Attendance {
  id: number;
  learner_id: number;
  learner_name: string | null;
  learner_id_number: string | null;
  site_id: number;
  site_name: string | null;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  hours: number | null;
  geofence_result: GeofenceResult;
  distance_from_site_meters: number | null;
  attendance_status: string;
  verification_status: VerificationStatus;
  signature_url: string | null;
}

export interface DashboardStats {
  total_learners: number;
  checked_in_today: number;
  pending_verification: number;
  stipend_arrears_days: number;
  stipend_arrears_rand: number;
}

export interface SiteHeadcount {
  id: number;
  name: string;
  current: number;
  total: number;
  ratio: number;
  status: SiteStatus;
}

export interface HeatmapDay {
  date: string;
  count: number;
  total: number;
  intensity: HeatIntensity;
}

export interface Alert {
  severity: "critical" | "warning" | "info";
  message: string;
  learner_id: number | null;
  site_id: number | null;
}

export interface StipendSummary {
  period_start: string;
  period_end: string;
  total_learners: number;
  total_verified_days: number;
  total_amount_rand: number;
  current_batch_status: BatchStatus | null;
}

export interface StipendPreviewLine {
  learner_id: number;
  learner_name: string;
  id_number: string;
  verified_days: number;
  daily_rate: number;
  total_amount: number;
}

export interface StipendPreview {
  period_start: string;
  period_end: string;
  total_learners: number;
  total_days: number;
  total_amount_rand: number;
  lines: StipendPreviewLine[];
}

export interface StipendLineItem {
  id: number;
  learner_id: number;
  learner_name: string | null;
  verified_days: number;
  daily_rate: number;
  total_amount: number;
  payment_status: PaymentStatus;
}

export interface StipendBatch {
  id: number;
  provider_id: number;
  period_start: string;
  period_end: string;
  total_learners: number;
  total_days: number;
  total_amount_rand: number;
  status: BatchStatus;
  initiated_by: number | null;
  line_items: StipendLineItem[];
}

export interface Site {
  id: number;
  provider_id: number;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
}

// Composed view used by the dashboard learner register (spec §4.6): a learner
// plus their attendance state for today.
export interface RegisterItem {
  learner_id: number;
  name: string;
  id_number: string;
  checked_in: boolean;
  check_in_time: string | null;
  geofence: GeofenceResult | null;
  verification: VerificationStatus | null;
  site_latitude: number;
  site_longitude: number;
}

export interface Programme {
  id: number;
  provider_id: number;
  name: string;
  sector: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Provider {
  id: number;
  name: string;
  registration_number: string | null;
  contact_email: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  full_name: string | null;
  role: Role;
  provider_id: number | null;
  site_id: number | null;
  learner_id: number | null;
}

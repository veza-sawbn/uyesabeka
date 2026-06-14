"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { fetchHeatmap } from "@/app/(dashboard)/actions";
import type { HeatmapDay } from "@/lib/types";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LEGEND: { cls: string; label: string }[] = [
  { cls: "heat-low", label: "<50%" },
  { cls: "heat-moderate", label: "50–74%" },
  { cls: "heat-good", label: "75–89%" },
  { cls: "heat-full", label: "90%+" },
  { cls: "heat-weekend", label: "Weekend" },
];

const todayISO = new Date().toISOString().slice(0, 10);

export default function HeatmapCalendar({
  initialDays,
  year: initialYear,
  month: initialMonth,
}: {
  initialDays: HeatmapDay[];
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 1-12
  const [days, setDays] = useState<HeatmapDay[]>(initialDays);
  const [pending, startTransition] = useTransition();

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    startTransition(async () => {
      setDays(await fetchHeatmap(y, m));
    });
  }

  // Leading blanks so the 1st lands under the right weekday (Mon-first grid).
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  return (
    <div className="card detail-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="card-title">Attendance heatmap</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button className="page-pill" onClick={() => navigate(-1)} aria-label="Previous month">
            ‹
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 110, textAlign: "center" }}>
            {MONTHS[month - 1]} {year}
          </span>
          <button className="page-pill" onClick={() => navigate(1)} aria-label="Next month">
            ›
          </button>
        </div>
      </div>

      <div className="heat-head-row" style={{ marginBottom: 4 }}>
        {DOW.map((d) => (
          <div className="heat-head" key={d}>
            {d}
          </div>
        ))}
      </div>

      <div className="heat-grid" style={{ opacity: pending ? 0.5 : 1 }}>
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div className="heat-cell heat-empty" key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const isToday = day.date === todayISO;
          const dayNum = Number(day.date.slice(8, 10));
          return (
            <div
              key={day.date}
              className={`heat-cell heat-${day.intensity} ${isToday ? "heat-today" : ""}`}
              title={`${day.date}: ${day.count}/${day.total} present`}
              onClick={() => router.push(`/attendance?date_from=${day.date}&date_to=${day.date}`)}
            >
              {dayNum}
            </div>
          );
        })}
      </div>

      <div className="heat-legend">
        {LEGEND.map((l) => (
          <div className="legend-item" key={l.label}>
            <span className={`legend-sq ${l.cls}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

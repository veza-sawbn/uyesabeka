"use client";

import { useEffect, useState } from "react";

import { fetchSiteHeadcounts } from "@/app/(dashboard)/actions";
import type { SiteHeadcount } from "@/lib/types";

// Live per-site headcount rail. Polls every 60s (spec §4.2: no WebSockets).
export default function SiteRail({ initial }: { initial: SiteHeadcount[] }) {
  const [sites, setSites] = useState<SiteHeadcount[]>(initial);

  useEffect(() => {
    const id = setInterval(async () => {
      const next = await fetchSiteHeadcounts();
      if (next.length) setSites(next);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="site-rail">
      <span className="rail-label">Sites</span>
      {sites.length === 0 ? (
        <span className="site-name" style={{ opacity: 0.5, paddingLeft: 4 }}>
          No active sites
        </span>
      ) : (
        sites.map((s) => (
          <div className="site-pill" key={s.id}>
            <span className={`site-dot s-${s.status}`} />
            <span className="site-name">{s.name}</span>
            <span className={`site-count s-${s.status}`}>
              {s.current}/{s.total}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

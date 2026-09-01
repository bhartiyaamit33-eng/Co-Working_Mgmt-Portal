import { useMemo } from "react";

// Map a seat number (1-55) to its cluster id (1-10).
const clusterOf = (id) => {
  if (id <= 6) return 1;
  if (id <= 12) return 2;
  if (id <= 18) return 3;
  if (id <= 23) return 4;
  if (id <= 29) return 5;
  if (id <= 35) return 6;
  if (id <= 40) return 10;
  if (id <= 45) return 9;
  if (id <= 50) return 8;
  return 7;
};

/** Seat circle radius in viewBox units (matches rendered circles below). */
const SEAT_R = 2.3;
/** Clear gap between table line end and seat circle — reads as table edge, not intersecting chair. */
const TABLE_GAP = 1.2;
/** Short offset from cluster hub so spokes radiate cleanly from centre. */
const HUB_INSET = 1.05;

/**
 * Table spoke from hub toward a seat centre, clipped so it stops outside the seat circle (tangent-like gap).
 */
function clippedTableBranch(jx, jy, tx, ty) {
  const dx = tx - jx;
  const dy = ty - jy;
  const len = Math.hypot(dx, dy);
  if (len < 0.05) return null;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = jx + ux * HUB_INSET;
  const y1 = jy + uy * HUB_INSET;
  const x2 = tx - ux * (SEAT_R + TABLE_GAP);
  const y2 = ty - uy * (SEAT_R + TABLE_GAP);
  const spokeLen = (x2 - x1) * ux + (y2 - y1) * uy;
  if (spokeLen < 0.35) return null;
  return { x1, y1, x2, y2 };
}

/**
 * FloorMap — 4th floor DSSE fishbone. Circles = chairs; lines = table legs/spines (never drawn through chairs).
 */
export default function FloorMap({
  seats = [],
  bookings = [],
  workingHours = [9, 18],
  selectedSeatId,
  selectedSeatIds = [],
  onSeatClick,
  /** When true (admin seats UI), maintenance/blocked seats remain clickable so status can be toggled. */
  allowLockedSeatSelection = false,
}) {
  const totalHours = workingHours[1] - workingHours[0];

  const seatStatus = useMemo(() => {
    const status = {};
    for (const s of seats) {
      status[s.id] = {
        hours: 0,
        unavailable: s.status === "maintenance" || s.status === "blocked",
      };
    }
    for (const b of bookings) {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const h = (end - start) / 3600000;
      if (status[b.seat_id]) status[b.seat_id].hours += h;
    }
    return status;
  }, [seats, bookings]);

  const colorFor = (seat) => {
    if (selectedSeatId === seat.id || selectedSeatIds.includes(seat.id)) return { fill: "#E8A33D", stroke: "#1B2A4E", text: "#1B2A4E" };
    const st = seatStatus[seat.id];
    if (!st) return { fill: "#fff", stroke: "#1B2A4E33", text: "#1B2A4E" };
    if (st.unavailable) return { fill: "#E5E7EB", stroke: "#94A3B8", text: "#64748B" };
    if (st.hours === 0) return { fill: "#ECFDF5", stroke: "#298F4A", text: "#1B2A4E" };
    if (st.hours >= totalHours) return { fill: "#FEF2F2", stroke: "#D93838", text: "#1B2A4E" };
    return { fill: "#FEF6E7", stroke: "#E8A33D", text: "#1B2A4E" };
  };

  const clusters = useMemo(() => {
    const groups = {};
    for (const s of seats) {
      const cid = clusterOf(s.id);
      (groups[cid] ||= []).push(s);
    }
    return Object.entries(groups).map(([cid, members]) => {
      const spineSeats = members.filter((s) => s.role && s.role.startsWith("spine"));
      const corners = members.filter((s) => s.role && !s.role.startsWith("spine"));
      if (spineSeats.length === 0 || corners.length === 0) return null;
      const spineY = spineSeats[0].position_y;
      const junctionX = corners.reduce((sum, s) => sum + s.position_x, 0) / corners.length;
      return {
        cid: parseInt(cid, 10),
        spineY,
        junctionX,
        spineSeats,
        corners,
      };
    }).filter(Boolean);
  }, [seats]);

  const isSeatLocked = (seat) => seat.status === "maintenance" || seat.status === "blocked";
  const clickBlocked = (seat) => isSeatLocked(seat) && !allowLockedSeatSelection;

  /** Pillar for cluster with seats 19–23: draw between #22 and #23 from layout data. */
  const pillarLayout = useMemo(() => {
    const s22 = seats.find((s) => s.id === 22);
    const s23 = seats.find((s) => s.id === 23);
    const w = 2.9;
    const h = 5.4;
    if (s22 && s23) {
      const mx = (s22.position_x + s23.position_x) / 2;
      const my = (s22.position_y + s23.position_y) / 2;
      return { x: mx - w / 2, y: my - h / 2, w, h, lx: mx, ly: my + h / 2 + 2.2 };
    }
    return { x: 74.05, y: 56.8, w, h, lx: 75.5, ly: 64.5 };
  }, [seats]);

  return (
    <div className="relative w-full bg-white rounded-xl border border-navy/10 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="label-eyebrow">Floor plan · 4th floor, DSSE building</span>
        <Legend />
      </div>
      <div className="relative w-full" style={{ aspectRatio: "10 / 12" }}>
        <svg viewBox="0 0 100 100" className="w-full h-full" data-testid="floor-map-svg">
          <rect x="2" y="2" width="96" height="96" rx="2" fill="#FAFAF7" stroke="#1B2A4E" strokeOpacity="0.15" strokeWidth="0.3" />

          <g>
            <rect x="6" y="4" width="12" height="6" rx="1" fill="#1B2A4E" fillOpacity="0.08" stroke="#1B2A4E" strokeOpacity="0.4" strokeWidth="0.2" />
            <text x="12" y="8" fontSize="2.2" textAnchor="middle" fill="#1B2A4E" className="font-sans font-medium">GATE</text>
            <line x1="18" y1="7" x2="22" y2="7" stroke="#1B2A4E" strokeOpacity="0.5" strokeWidth="0.4" markerEnd="url(#floor-arrow)" />
          </g>
          <defs>
            <marker id="floor-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#1B2A4E" fillOpacity="0.5" />
            </marker>
          </defs>

          <rect
            x={pillarLayout.x}
            y={pillarLayout.y}
            width={pillarLayout.w}
            height={pillarLayout.h}
            rx="0.35"
            fill="#1B2A4E"
            fillOpacity="0.25"
          />
          <text
            x={pillarLayout.lx}
            y={pillarLayout.ly}
            fontSize="1.6"
            textAnchor="middle"
            fill="#1B2A4E"
            fillOpacity="0.6"
            className="font-sans"
          >
            Pillar
          </text>

          {clusters.map((c) => (
            <g key={`cluster-${c.cid}`}>
              {/* Hub — tables radiate from here; spokes stop short of chair circles */}
              <circle cx={c.junctionX} cy={c.spineY} r="0.45" fill="#1B2A4E" fillOpacity="0.35" />
              {c.corners.map((seat) => {
                const seg = clippedTableBranch(c.junctionX, c.spineY, seat.position_x, seat.position_y);
                if (!seg) return null;
                return (
                  <line
                    key={`tb-${seat.id}`}
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke="#1B2A4E"
                    strokeOpacity="0.38"
                    strokeWidth="0.42"
                    strokeLinecap="round"
                  />
                );
              })}
              {c.spineSeats.map((seat) => {
                const seg = clippedTableBranch(c.junctionX, c.spineY, seat.position_x, seat.position_y);
                if (!seg) return null;
                return (
                  <line
                    key={`ts-${seat.id}`}
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke="#1B2A4E"
                    strokeOpacity="0.38"
                    strokeWidth="0.42"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          ))}

          {seats.map((seat) => {
            const c = colorFor(seat);
            const isSelected = selectedSeatId === seat.id || selectedSeatIds.includes(seat.id);
            const locked = isSeatLocked(seat);
            const noClick = clickBlocked(seat);
            return (
              <g
                key={seat.id}
                className={noClick ? "cursor-not-allowed" : "cursor-pointer"}
                onClick={() => !noClick && onSeatClick && onSeatClick(seat)}
                data-testid={`seat-${seat.id}`}
              >
                <circle
                  cx={seat.position_x}
                  cy={seat.position_y}
                  r={isSelected ? 2.7 : 2.3}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={isSelected ? 0.6 : 0.4}
                  className={locked ? "opacity-95" : "transition-all duration-150 hover:opacity-80"}
                />
                <text
                  x={seat.position_x}
                  y={seat.position_y + 0.7}
                  fontSize="1.7"
                  textAnchor="middle"
                  fill={c.text}
                  className="font-sans font-medium pointer-events-none select-none"
                >
                  {seat.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Available", fill: "#ECFDF5", stroke: "#298F4A" },
    { label: "Partial", fill: "#FEF6E7", stroke: "#E8A33D" },
    { label: "Full", fill: "#FEF2F2", stroke: "#D93838" },
    { label: "Unavailable", fill: "#E5E7EB", stroke: "#94A3B8" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border" style={{ background: i.fill, borderColor: i.stroke }} />
          <span className="text-slate-500">{i.label}</span>
        </span>
      ))}
    </div>
  );
}

import { useMemo } from "react";

/**
 * FloorMap — renders the 55-seat fishbone layout as an interactive SVG.
 * Props:
 *  - seats: array of {id, position_x, position_y, status, role, zone}
 *  - bookings: array of {seat_id, start_time, end_time, status} for the selected day
 *  - workingHours: [start, end] (e.g., [9, 18])
 *  - selectedSeatId: number | null
 *  - onSeatClick: fn(seat)
 */
export default function FloorMap({ seats = [], bookings = [], workingHours = [9, 18], selectedSeatId, onSeatClick }) {
  const totalHours = workingHours[1] - workingHours[0];

  // Map seat_id -> hours booked count
  const seatStatus = useMemo(() => {
    const status = {};
    for (const s of seats) {
      status[s.id] = { hours: 0, maintenance: s.status === "maintenance" };
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
    if (selectedSeatId === seat.id) return { fill: "#E8A33D", stroke: "#1B2A4E", text: "#1B2A4E" };
    const st = seatStatus[seat.id];
    if (!st) return { fill: "#fff", stroke: "#1B2A4E33", text: "#1B2A4E" };
    if (st.maintenance) return { fill: "#E5E7EB", stroke: "#94A3B8", text: "#64748B" };
    if (st.hours === 0) return { fill: "#ECFDF5", stroke: "#298F4A", text: "#1B2A4E" };
    if (st.hours >= totalHours) return { fill: "#FEF2F2", stroke: "#D93838", text: "#1B2A4E" };
    return { fill: "#FEF6E7", stroke: "#E8A33D", text: "#1B2A4E" };
  };

  // Build cluster spines for visual ribs
  const spines = useMemo(() => {
    // Group by approximate center y, then plot horizontal lines from min to max x
    const groups = {};
    for (const s of seats) {
      // Each cluster shares a "center y" near the spine seats; group by y (rounded to 5)
      const isSpine = s.role === "spine_left" || s.role === "spine_right";
      if (!isSpine) continue;
      const key = Math.round(s.position_y);
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    const lines = [];
    Object.values(groups).forEach((arr) => {
      if (arr.length === 1) {
        // Left cluster (single tip): draw line going inward
        const s = arr[0];
        if (s.position_x < 50) {
          lines.push({ x1: s.position_x, y1: s.position_y, x2: 23, y2: s.position_y });
        } else {
          lines.push({ x1: s.position_x, y1: s.position_y, x2: 67, y2: s.position_y });
        }
      } else if (arr.length === 2) {
        const [a, b] = arr.sort((p, q) => p.position_x - q.position_x);
        lines.push({ x1: a.position_x, y1: a.position_y, x2: b.position_x, y2: b.position_y });
      }
    });
    return lines;
  }, [seats]);

  return (
    <div className="relative w-full bg-white rounded-xl border border-navy/10 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="label-eyebrow">Floor Plan · 4th Floor, DSSE Building</span>
        <Legend />
      </div>
      <div className="relative w-full" style={{ aspectRatio: "10 / 12" }}>
        <svg viewBox="0 0 100 100" className="w-full h-full" data-testid="floor-map-svg">
          {/* Outer floor outline */}
          <rect x="2" y="2" width="96" height="96" rx="2" fill="#FAFAF7" stroke="#1B2A4E" strokeOpacity="0.15" strokeWidth="0.3" />
          {/* Gate (top-left) */}
          <g>
            <rect x="6" y="4" width="12" height="6" rx="1" fill="#1B2A4E" fillOpacity="0.08" stroke="#1B2A4E" strokeOpacity="0.4" strokeWidth="0.2" />
            <text x="12" y="8" fontSize="2.2" textAnchor="middle" fill="#1B2A4E" className="font-sans font-medium">GATE</text>
            <line x1="18" y1="7" x2="22" y2="7" stroke="#1B2A4E" strokeOpacity="0.5" strokeWidth="0.4" markerEnd="url(#arrow)" />
          </g>
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#1B2A4E" fillOpacity="0.5" />
            </marker>
          </defs>

          {/* Pillar */}
          <rect x="86" y="55" width="3" height="4" fill="#1B2A4E" fillOpacity="0.25" />
          <text x="87.5" y="62" fontSize="1.6" textAnchor="middle" fill="#1B2A4E" fillOpacity="0.6" className="font-sans">Pillar</text>

          {/* Cluster spines */}
          {spines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#1B2A4E" strokeOpacity="0.18" strokeWidth="0.3" strokeDasharray="0.5 0.4" />
          ))}

          {/* Connector lines from spine to off-spine seats */}
          {seats.map((s) => {
            if (s.role === "spine_left" || s.role === "spine_right") return null;
            // Find the closest spine seat in same cluster (similar y range)
            const nearestSpine = seats
              .filter((x) => (x.role === "spine_left" || x.role === "spine_right") && Math.abs(x.position_y - s.position_y) < 6)
              .sort((a, b) => Math.abs(a.position_x - s.position_x) - Math.abs(b.position_x - s.position_x))[0];
            if (!nearestSpine) return null;
            return (
              <line
                key={`c-${s.id}`}
                x1={nearestSpine.position_x}
                y1={nearestSpine.position_y}
                x2={s.position_x}
                y2={s.position_y}
                stroke="#1B2A4E"
                strokeOpacity="0.1"
                strokeWidth="0.2"
              />
            );
          })}

          {/* Seats */}
          {seats.map((seat) => {
            const c = colorFor(seat);
            return (
              <g key={seat.id} className="cursor-pointer" onClick={() => onSeatClick && onSeatClick(seat)} data-testid={`seat-${seat.id}`}>
                <circle
                  cx={seat.position_x}
                  cy={seat.position_y}
                  r={selectedSeatId === seat.id ? 2.6 : 2.2}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={selectedSeatId === seat.id ? 0.5 : 0.3}
                  className="transition-all duration-150 hover:opacity-80"
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
    { label: "Maintenance", fill: "#E5E7EB", stroke: "#94A3B8" },
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

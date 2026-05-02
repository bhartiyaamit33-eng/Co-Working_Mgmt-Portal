import { useMemo } from "react";

// Map a seat number (1-55) to its cluster id (1-10).
// Right column (top→bottom): 1-6, 7-12, 13-18, 19-23 (pillar/5 seats), 24-29, 30-35
// Left column (top→bottom near gate first): 51-55, 46-50, 41-45, 36-40
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

/**
 * FloorMap — renders the 55-seat fishbone layout as an interactive SVG.
 * Each cluster is drawn with a clear skeleton:
 *  - a main horizontal spine that extends beyond the outermost seats
 *  - 4 diagonal branches from a central junction to each corner seat
 * Seats are always circles regardless of role.
 */
export default function FloorMap({ seats = [], bookings = [], workingHours = [9, 18], selectedSeatId, onSeatClick }) {
  const totalHours = workingHours[1] - workingHours[0];

  const seatStatus = useMemo(() => {
    const status = {};
    for (const s of seats) status[s.id] = { hours: 0, maintenance: s.status === "maintenance" };
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

  // Build cluster geometry: spine + 4 diagonal branches per cluster.
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
      // Junction sits at the midpoint of the corner seats' X coordinates, on the spine line.
      const junctionX = corners.reduce((sum, s) => sum + s.position_x, 0) / corners.length;
      const minX = Math.min(...members.map((s) => s.position_x));
      const maxX = Math.max(...members.map((s) => s.position_x));
      // Extend the spine 4 units past the outermost seats so the skeleton is visible.
      return {
        cid: parseInt(cid),
        spineY,
        junctionX,
        spineStart: minX - 4,
        spineEnd: maxX + 4,
        corners,
      };
    }).filter(Boolean);
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

          {/* Cluster skeletons: main spine + 4 diagonal branches per cluster */}
          {clusters.map((c) => (
            <g key={`cluster-${c.cid}`}>
              {/* Main horizontal spine, extended beyond the outermost seats */}
              <line
                x1={c.spineStart} y1={c.spineY}
                x2={c.spineEnd} y2={c.spineY}
                stroke="#1B2A4E" strokeOpacity="0.4" strokeWidth="0.5" strokeLinecap="round"
              />
              {/* Diagonal branches from the junction to each corner seat */}
              {c.corners.map((corner) => (
                <line
                  key={`branch-${corner.id}`}
                  x1={c.junctionX} y1={c.spineY}
                  x2={corner.position_x} y2={corner.position_y}
                  stroke="#1B2A4E" strokeOpacity="0.35" strokeWidth="0.4" strokeLinecap="round"
                />
              ))}
              {/* Junction dot for visual anchor */}
              <circle cx={c.junctionX} cy={c.spineY} r="0.5" fill="#1B2A4E" fillOpacity="0.5" />
            </g>
          ))}

          {/* Seats — always circles */}
          {seats.map((seat) => {
            const c = colorFor(seat);
            const isSelected = selectedSeatId === seat.id;
            return (
              <g key={seat.id} className="cursor-pointer" onClick={() => onSeatClick && onSeatClick(seat)} data-testid={`seat-${seat.id}`}>
                <circle
                  cx={seat.position_x}
                  cy={seat.position_y}
                  r={isSelected ? 2.7 : 2.3}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={isSelected ? 0.6 : 0.4}
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

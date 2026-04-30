import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import FloorMap from "@/components/FloorMap";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Clock, MapPin, X, Grid3x3, Map } from "lucide-react";

const fmtDate = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });
const isoDate = (d) => d.toISOString().slice(0, 10);

export default function Book() {
  const { user, team } = useAuth();
  const [view, setView] = useState("map");
  const [seats, setSeats] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [config, setConfig] = useState(null);
  const [date, setDate] = useState(new Date());
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [drawerHours, setDrawerHours] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadInitial = useCallback(async () => {
    const [s, c] = await Promise.all([api.get("/seats"), api.get("/configuration")]);
    setSeats(s.data);
    setConfig(c.data);
  }, []);
  const loadDayBookings = useCallback(async (d) => {
    const { data } = await api.get(`/bookings/day-overview`, { params: { day: isoDate(d) } });
    setBookings(data);
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);
  useEffect(() => {
    if (!date) return;
    loadDayBookings(date);
  }, [date, loadDayBookings]);

  const dates = useMemo(() => {
    const out = [];
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(t);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const workingHours = config ? [config.working_hours_start, config.working_hours_end] : [9, 18];
  const hourSlots = useMemo(() => {
    const arr = [];
    for (let h = workingHours[0]; h < workingHours[1]; h++) arr.push(h);
    return arr;
  }, [workingHours]);

  const onSeatClick = (seat) => {
    setSelectedSeat(seat);
    setDrawerHours([]);
  };
  const closeDrawer = () => { setSelectedSeat(null); setDrawerHours([]); };

  const seatBookingsForDate = useMemo(() => {
    if (!selectedSeat) return [];
    return bookings.filter((b) => b.seat_id === selectedSeat.id);
  }, [bookings, selectedSeat]);

  const isHourBooked = (h) => {
    return seatBookingsForDate.some((b) => {
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      return s.getHours() <= h && e.getHours() > h;
    });
  };

  const toggleHour = (h) => {
    if (isHourBooked(h)) return;
    if (drawerHours.includes(h)) setDrawerHours(drawerHours.filter((x) => x !== h));
    else {
      const next = [...drawerHours, h].sort((a, b) => a - b);
      // Must be contiguous
      const valid = next.every((x, i) => i === 0 || x === next[i - 1] + 1);
      if (!valid) {
        toast.error("Hours must be contiguous.");
        return;
      }
      if (next.length > (config?.max_booking_hours || 4)) {
        toast.error(`Max ${config?.max_booking_hours || 4} hours per booking.`);
        return;
      }
      setDrawerHours(next);
    }
  };

  const submitBooking = async () => {
    if (!selectedSeat || drawerHours.length === 0) return;
    setBusy(true);
    try {
      const start = new Date(date);
      start.setHours(drawerHours[0], 0, 0, 0);
      const end = new Date(date);
      end.setHours(drawerHours[drawerHours.length - 1] + 1, 0, 0, 0);
      const { data } = await api.post("/bookings", {
        seat_id: selectedSeat.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      toast.success(data.status === "approved" ? "Booking confirmed!" : "Booking submitted. Awaiting approval.");
      closeDrawer();
      await loadDayBookings(date);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to book");
    } finally { setBusy(false); }
  };

  return (
    <Layout title="Book a workstation" subtitle="Reserve your seat"
      actions={
        <div className="inline-flex bg-navy/5 rounded-xl p-1" role="tablist">
          <button data-testid="view-floor-btn" onClick={() => setView("map")} className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${view === "map" ? "bg-white text-navy shadow-sm" : "text-navy/60"}`}>
            <Map className="w-3.5 h-3.5" /> Floor Map
          </button>
          <button data-testid="view-timeline-btn" onClick={() => setView("timeline")} className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${view === "timeline" ? "bg-white text-navy shadow-sm" : "text-navy/60"}`}>
            <Grid3x3 className="w-3.5 h-3.5" /> Timeline
          </button>
        </div>
      }>
      {/* Date selector */}
      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-1">
        {dates.map((d) => {
          const active = isoDate(d) === isoDate(date);
          return (
            <button key={isoDate(d)} onClick={() => setDate(d)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${active ? "bg-navy text-white" : "bg-white border border-navy/10 text-navy hover:border-amber/40"}`}
              data-testid={`date-tab-${isoDate(d)}`}>
              {fmtDate(d)}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          {view === "map" ? (
            <FloorMap
              seats={seats}
              bookings={bookings}
              workingHours={workingHours}
              selectedSeatId={selectedSeat?.id}
              onSeatClick={onSeatClick}
            />
          ) : (
            <TimelineView seats={seats} bookings={bookings} hours={hourSlots} selectedSeatId={selectedSeat?.id} onCellClick={(seat) => onSeatClick(seat)} />
          )}
        </div>
        {/* Summary card */}
        <aside className="dsse-card p-6 h-fit sticky top-24" data-testid="booking-summary">
          <span className="label-eyebrow">Booking summary</span>
          {selectedSeat ? (
            <div className="mt-3 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber/15 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <div className="font-serif text-xl text-navy">Seat #{selectedSeat.id}</div>
                  <div className="text-xs text-slate-500">{selectedSeat.zone} · {fmtDate(date)}</div>
                </div>
              </div>
              <div className="text-sm text-slate-600">
                Hours selected:{" "}
                <span className="font-medium text-navy">{drawerHours.length === 0 ? "none" : `${drawerHours.length}h (${drawerHours[0]}:00–${drawerHours[drawerHours.length - 1] + 1}:00)`}</span>
              </div>
              <button className="btn-accent w-full" disabled={drawerHours.length === 0 || busy} onClick={submitBooking} data-testid="confirm-booking-btn">
                {busy ? "Submitting…" : "Confirm Booking"}
              </button>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Your booking will be sent for admin approval. You'll be notified once confirmed.
              </p>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-500">
              {view === "map" ? "Click any seat on the map to select." : "Click a cell in the timeline to start."}
            </div>
          )}
        </aside>
      </div>

      {/* Drawer for hour selection */}
      {selectedSeat && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm pointer-events-auto" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white shadow-2xl pointer-events-auto overflow-y-auto animate-fade-in" data-testid="seat-drawer">
            <div className="sticky top-0 bg-white border-b border-navy/10 p-6 flex items-start justify-between">
              <div>
                <span className="label-eyebrow text-amber-700">Seat #{selectedSeat.id}</span>
                <h3 className="font-serif text-2xl text-navy mt-1">Pick your hours</h3>
                <p className="text-xs text-slate-500 mt-1">{fmtDate(date)} · {selectedSeat.zone} zone · {workingHours[0]}:00–{workingHours[1]}:00</p>
              </div>
              <button onClick={closeDrawer} className="p-2 hover:bg-navy/5 rounded-lg" data-testid="close-drawer">
                <X className="w-5 h-5 text-navy" />
              </button>
            </div>
            <div className="p-6 space-y-2">
              {hourSlots.map((h) => {
                const booked = isHourBooked(h);
                const selected = drawerHours.includes(h);
                return (
                  <button
                    key={h}
                    disabled={booked}
                    onClick={() => toggleHour(h)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all
                      ${booked ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-60" :
                        selected ? "bg-amber/15 border-amber" :
                        "border-navy/10 hover:border-amber/40 hover:bg-amber/5"}`}
                    data-testid={`hour-${h}`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <Clock className="w-4 h-4 text-navy/60" />
                      <span className="font-medium text-navy">{h}:00 – {h + 1}:00</span>
                    </span>
                    <span className="text-xs">
                      {booked ? <span className="text-slate-500 uppercase tracking-wider font-semibold">Booked</span> :
                        selected ? <span className="text-amber-700 uppercase tracking-wider font-semibold">Selected</span> :
                        <span className="text-emerald-700 uppercase tracking-wider font-semibold">Free</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-navy/10 p-6">
              <button className="btn-accent w-full" disabled={drawerHours.length === 0 || busy} onClick={submitBooking} data-testid="drawer-confirm-btn">
                {busy ? "Submitting…" : drawerHours.length === 0 ? "Select hours to continue" : `Book ${drawerHours.length}h`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function TimelineView({ seats, bookings, hours, selectedSeatId, onCellClick }) {
  const cellState = (seatId, h) => {
    const b = bookings.find((b) => b.seat_id === seatId && new Date(b.start_time).getHours() <= h && new Date(b.end_time).getHours() > h);
    if (!b) return "free";
    return b.status === "approved" ? "approved" : "pending";
  };
  const seat = (id) => seats.find((s) => s.id === id);
  return (
    <div className="dsse-card p-4 sm:p-6 overflow-x-auto">
      <span className="label-eyebrow mb-3 block">Timeline · seat × hour</span>
      <div className="min-w-[640px]">
        <div className="grid" style={{ gridTemplateColumns: `60px repeat(${hours.length}, 1fr)` }}>
          <div></div>
          {hours.map((h) => <div key={h} className="text-[10px] text-slate-500 text-center pb-2">{h}:00</div>)}
          {seats.map((s) => (
            <Fragment key={`row-${s.id}`}>
              <div className="text-[11px] text-navy/70 font-medium pr-2 py-1 text-right">#{s.id}</div>
              {hours.map((h) => {
                const st = cellState(s.id, h);
                const isSel = selectedSeatId === s.id;
                const cls = st === "free" ? "bg-emerald-50 hover:bg-amber/20 cursor-pointer" :
                  st === "approved" ? "bg-red-100 cursor-not-allowed" :
                  "bg-amber/30 cursor-not-allowed";
                return (
                  <div
                    key={`${s.id}-${h}`}
                    className={`m-0.5 h-6 rounded ${cls} ${isSel ? "ring-2 ring-amber" : ""} transition-colors`}
                    onClick={() => st === "free" && onCellClick(s)}
                    data-testid={`tl-${s.id}-${h}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

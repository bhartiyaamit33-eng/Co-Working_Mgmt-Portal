import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { ArrowRight, Calendar, Clock, MapPin, AlertCircle, Sparkles } from "lucide-react";
import GuidelinesAcceptModal from "@/components/GuidelinesAcceptModal";

export default function Dashboard() {
  const { user, team } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [config, setConfig] = useState(null);
  const [usage, setUsage] = useState({ daily: 0, weekly: 0, monthly: 0 });

  const loadBookings = useCallback(async () => {
    const { data } = await api.get("/bookings/mine");
    setBookings(data);
  }, []);
  const loadConfig = useCallback(async () => {
    const { data } = await api.get("/configuration");
    setConfig(data);
  }, []);
  const loadTeamUsage = useCallback(async (teamId) => {
    const { data } = await api.get(`/teams/${teamId}`);
    setUsage({
      daily: data.daily_hours || 0,
      weekly: data.weekly_hours || 0,
      monthly: data.monthly_hours || 0,
    });
  }, []);

  useEffect(() => {
    loadBookings();
    loadConfig();
  }, [loadBookings, loadConfig]);

  useEffect(() => {
    if (!team) return;
    loadTeamUsage(team.id).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("team usage load failed:", e);
    });
  }, [team, loadTeamUsage]);

  const upcoming = bookings.filter((b) => ["pending", "approved"].includes(b.status) && new Date(b.start_time) > new Date()).slice(0, 5);
  const weeklyCap = config?.weekly_cap_hours || 20;

  return (
    <Layout title={`Hello, ${user?.first_name}`} subtitle="Member dashboard"
      actions={<Link to="/book" className="btn-accent" data-testid="quick-book-cta"><Sparkles className="w-4 h-4" /> Quick book</Link>}>
      <GuidelinesAcceptModal />

      {/* Top KPI row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="dsse-card p-6">
          <span className="label-eyebrow">Team</span>
          <div className="font-serif text-2xl text-navy mt-2">{team?.name || "—"}</div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mt-1">{team?.program?.replace("_", " ") || "Not assigned"}</div>
        </div>
        <QuotaCard label="Today" used={usage.daily} cap={config?.daily_cap_hours || 4} />
        <QuotaCard label="This week" used={usage.weekly} cap={weeklyCap} />
        <QuotaCard label="This month" used={usage.monthly} cap={config?.monthly_cap_hours || 80} />
      </div>

      {/* Upcoming bookings */}
      <div className="dsse-card p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="label-eyebrow">Upcoming bookings</span>
          <Link to="/bookings" className="text-xs text-amber-700 hover:text-amber-800 inline-flex items-center gap-1" data-testid="dashboard-all-bookings">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="w-8 h-8 text-navy/20 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No upcoming bookings.</p>
            <Link to="/book" className="btn-accent mt-4 inline-flex" data-testid="empty-book-cta">Book your first seat</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => <BookingRow key={b.id} b={b} />)}
          </div>
        )}
      </div>

      {!team && user?.status === "active" && (
        <div className="dsse-card p-6 border-l-4 border-amber">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-serif text-lg text-navy">No team assigned yet</h3>
              <p className="text-sm text-slate-600 mt-1">Contact your program admin to be added to a team. You won't be able to book until your team is active.</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function QuotaCard({ label, used, cap }) {
  return (
    <div className="dsse-card p-6">
      <span className="label-eyebrow">{label}</span>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-serif text-3xl text-navy">{used}</span>
        <span className="text-slate-400 text-sm">/ {cap}h</span>
      </div>
      <div className="mt-3 h-2 bg-navy/5 rounded-full overflow-hidden">
        <div className="h-full bg-amber rounded-full transition-all" style={{ width: `${Math.min(100, (used / Math.max(cap, 1)) * 100)}%` }} />
      </div>
    </div>
  );
}

export function BookingRow({ b, onCancel }) {
  const start = new Date(b.start_time);
  const end = new Date(b.end_time);
  const date = start.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });
  const time = `${start.getHours()}:00–${end.getHours()}:00`;
  const badgeClass = {
    pending: "badge-pending", approved: "badge-approved",
    rejected: "badge-rejected", cancelled: "badge-cancelled",
    completed: "badge-approved", expired: "badge-cancelled", no_show: "badge-rejected"
  }[b.status] || "badge-cancelled";
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-navy/5 hover:border-amber/30 transition-colors" data-testid={`booking-row-${b.id}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-navy" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-navy">
            Seat #{b.seat_id}
            {b.user_name ? <span className="text-slate-500 font-normal"> · {b.user_name}</span> : null}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            <span>{date}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {time}</span>
          </div>
        </div>
      </div>
      <span className={badgeClass} data-testid={`booking-status-${b.id}`}>{b.status}</span>
      {onCancel && ["pending", "approved"].includes(b.status) && new Date(b.start_time) > new Date() && (
        <button onClick={() => onCancel(b)} className="btn-outline px-3 py-1.5 text-xs" data-testid={`cancel-booking-${b.id}`}>Cancel</button>
      )}
    </div>
  );
}

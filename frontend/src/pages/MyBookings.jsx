import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { BookingRow } from "./Dashboard";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

export default function MyBookings() {
  const [tab, setTab] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const load = () => api.get("/bookings/mine").then((r) => setBookings(r.data));
  useEffect(() => { load(); }, []);

  const now = new Date();
  const filtered = bookings.filter((b) => {
    if (tab === "upcoming") return ["pending", "approved"].includes(b.status) && new Date(b.start_time) > now;
    if (tab === "past") return new Date(b.end_time) < now || b.status === "completed";
    if (tab === "cancelled") return ["cancelled", "rejected", "no_show"].includes(b.status);
    return true;
  });

  const onCancel = async (b) => {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      await api.post(`/bookings/${b.id}/cancel`);
      toast.success("Booking cancelled");
      load();
    } catch (e) {
      toast.error("Failed to cancel");
    }
  };

  const tabs = [
    { id: "upcoming", label: "Upcoming" },
    { id: "past", label: "Past" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <Layout title="My bookings" subtitle="History & status">
      <div className="flex gap-1 mb-6 bg-navy/5 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t.id ? "bg-white text-navy shadow-sm" : "text-navy/60"}`}
            data-testid={`tab-${t.id}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="dsse-card p-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="w-8 h-8 text-navy/20 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No bookings in this view.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => <BookingRow key={b.id} b={b} onCancel={onCancel} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}

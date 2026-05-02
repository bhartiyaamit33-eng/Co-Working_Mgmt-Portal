import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import FloorMap from "@/components/FloorMap";
import api from "@/lib/api";
import { toast } from "sonner";
import { Wrench } from "lucide-react";

export default function AdminSeats() {
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => api.get("/seats").then((r) => setSeats(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const toggleMaintenance = async () => {
    if (!selected) return;
    const next = selected.status === "available" ? "maintenance" : "available";
    await api.put(`/admin/seats/${selected.id}`, { status: next });
    toast.success(`Seat #${selected.id} → ${next}`);
    await load();
    setSelected({ ...selected, status: next });
  };

  return (
    <Layout title="Seats" subtitle="Floor map management">
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <FloorMap seats={seats} bookings={[]} selectedSeatId={selected?.id} onSeatClick={setSelected} allowLockedSeatSelection />
        <aside className="dsse-card p-6 h-fit">
          <span className="label-eyebrow">Seat details</span>
          {selected ? (
            <div className="mt-3 space-y-4">
              <div className="font-serif text-2xl text-navy">Seat #{selected.id}</div>
              <div className="text-sm text-slate-600">
                <div>Zone: <span className="text-navy font-medium">{selected.zone}</span></div>
                <div>Position: ({selected.position_x.toFixed(1)}, {selected.position_y.toFixed(1)})</div>
                <div>Status: <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${
                selected.status === "maintenance" || selected.status === "blocked"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-emerald-50 text-emerald-700"
              }`}>{selected.status}</span></div>
              </div>
              <button className={selected.status === "available" ? "btn-outline w-full" : "btn-accent w-full"} onClick={toggleMaintenance} data-testid="toggle-maintenance-btn">
                <Wrench className="w-4 h-4" />
                {selected.status === "available" ? "Mark maintenance" : "Mark available"}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Select a seat to manage it.</p>
          )}
        </aside>
      </div>
    </Layout>
  );
}

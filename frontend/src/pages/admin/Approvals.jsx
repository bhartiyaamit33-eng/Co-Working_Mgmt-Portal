import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export default function Approvals() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState("");

  const load = () => api.get("/admin/bookings/pending").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      await api.post(`/admin/bookings/${id}/approve`);
      toast.success("Approved");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const bulkApprove = async () => {
    if (selected.length === 0) return;
    await api.post("/admin/bookings/bulk-approve", { ids: selected });
    toast.success(`${selected.length} approved`);
    setSelected([]);
    load();
  };

  const submitReject = async () => {
    if (!reject || !reason.trim()) return;
    await api.post(`/admin/bookings/${reject.id}/reject`, { reason });
    toast.success("Rejected");
    setReject(null); setReason("");
    load();
  };

  const tierColor = (t) => t === 1 ? "text-emerald-700 bg-emerald-50" : t === 2 ? "text-amber-700 bg-amber-50" : "text-slate-600 bg-slate-50";

  return (
    <Layout title="Pending approvals" subtitle={`${items.length} item(s) in queue`}
      actions={selected.length > 0 && (
        <button className="btn-accent" onClick={bulkApprove} data-testid="bulk-approve-btn">
          Approve selected ({selected.length})
        </button>
      )}>
      <div className="dsse-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-left">
            <tr>
              <th className="p-4 w-10">
                <input type="checkbox" onChange={(e) => setSelected(e.target.checked ? items.map((x) => x.id) : [])} data-testid="select-all-checkbox" />
              </th>
              <th className="p-4 label-eyebrow">Team</th>
              <th className="p-4 label-eyebrow">User</th>
              <th className="p-4 label-eyebrow">Date / Time</th>
              <th className="p-4 label-eyebrow">Seat</th>
              <th className="p-4 label-eyebrow">Tier</th>
              <th className="p-4 label-eyebrow text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="p-12 text-center text-slate-400">Queue is clear. Nothing pending.</td></tr>
            ) : items.map((b) => {
              const start = new Date(b.start_time);
              const end = new Date(b.end_time);
              return (
                <tr key={b.id} className="border-t border-navy/5" data-testid={`approval-row-${b.id}`}>
                  <td className="p-4">
                    <input type="checkbox" checked={selected.includes(b.id)}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, b.id] : selected.filter((x) => x !== b.id))} />
                  </td>
                  <td className="p-4 text-navy font-medium">{b.team_name}<div className="text-[11px] text-slate-500 uppercase tracking-wider">{b.program?.replace("_", " ")}</div></td>
                  <td className="p-4 text-navy">{b.user_name}</td>
                  <td className="p-4 text-navy">{start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}<div className="text-[11px] text-slate-500">{start.getHours()}:00 – {end.getHours()}:00</div></td>
                  <td className="p-4 text-navy">#{b.seat_id}</td>
                  <td className="p-4"><span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${tierColor(b.priority_tier)}`}>Tier {b.priority_tier}</span></td>
                  <td className="p-4 text-right">
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs mr-2" onClick={() => approve(b.id)} data-testid={`approve-${b.id}`}>
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs" onClick={() => setReject(b)} data-testid={`reject-${b.id}`}>
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reject && (
        <div className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <span className="label-eyebrow">Reject booking</span>
            <h3 className="font-serif text-xl text-navy mt-2">Provide a reason</h3>
            <p className="text-sm text-slate-500 mt-1">Will be sent to {reject.user_name} as a notification.</p>
            <textarea className="input-field mt-4 min-h-[120px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., Quota exceeded for this week. Try a different day." data-testid="reject-reason" />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-outline" onClick={() => { setReject(null); setReason(""); }}>Cancel</button>
              <button className="btn-primary" disabled={!reason.trim()} onClick={submitReject} data-testid="confirm-reject-btn">Reject</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

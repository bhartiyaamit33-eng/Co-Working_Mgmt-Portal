import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, AlertTriangle } from "lucide-react";

export default function AdminViolations() {
  const [violations, setViolations] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => api.get("/admin/violations").then((r) => setViolations(r.data));
  useEffect(() => {
    load();
    api.get("/admin/users").then((r) => setUsers(r.data));
  }, []);

  return (
    <Layout title="Violations" subtitle="Tracking & enforcement"
      actions={<button className="btn-accent" onClick={() => setShowCreate(true)} data-testid="log-violation-btn"><Plus className="w-4 h-4" /> Log violation</button>}>
      <div className="dsse-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-left">
            <tr>
              <th className="p-4 label-eyebrow">User</th>
              <th className="p-4 label-eyebrow">Category</th>
              <th className="p-4 label-eyebrow">Severity</th>
              <th className="p-4 label-eyebrow">Action</th>
              <th className="p-4 label-eyebrow">Description</th>
              <th className="p-4 label-eyebrow">Date</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-slate-400">No violations logged. Keep it clean.</td></tr>
            ) : violations.map((v) => (
              <tr key={v.id} className="border-t border-navy/5" data-testid={`violation-row-${v.id}`}>
                <td className="p-4 text-navy">{v.user?.first_name} {v.user?.last_name}<div className="text-[11px] text-slate-500">{v.user?.email}</div></td>
                <td className="p-4 text-navy">{v.category}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${
                    v.severity === "tier_1" ? "bg-amber-50 text-amber-700" :
                    v.severity === "tier_2" ? "bg-orange-50 text-orange-700" :
                    "bg-red-50 text-red-700"
                  }`}>{v.severity}</span>
                </td>
                <td className="p-4 text-navy uppercase tracking-wider text-[10px] font-semibold">{v.auto_action}</td>
                <td className="p-4 text-slate-600">{v.description}</td>
                <td className="p-4 text-slate-500 text-xs">{new Date(v.created_at).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateViolation users={users} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </Layout>
  );
}

function CreateViolation({ users, onClose, onCreated }) {
  const [form, setForm] = useState({ user_id: "", category: "no_show", severity: "tier_1", description: "" });
  const submit = async () => {
    if (!form.user_id || !form.description) { toast.error("User and description required"); return; }
    try {
      await api.post("/admin/violations", form);
      toast.success("Violation logged");
      onCreated();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <span className="label-eyebrow">Log new violation</span>
        <h3 className="font-serif text-xl text-navy mt-2">Record incident</h3>
        <div className="space-y-3 mt-4">
          <select className="input-field" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} data-testid="cv-user">
            <option value="">— Select user —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>)}
          </select>
          <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="cv-category">
            {["no_show", "cleanliness", "damage", "conduct", "time_overrun", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
          <select className="input-field" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} data-testid="cv-severity">
            <option value="tier_1">Tier 1 — Warning</option>
            <option value="tier_2">Tier 2 — Restriction</option>
            <option value="tier_3">Tier 3 — Suspension</option>
          </select>
          <textarea className="input-field min-h-[100px]" placeholder="Describe the incident…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="cv-description" />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} data-testid="cv-submit">Log</button>
        </div>
      </div>
    </div>
  );
}

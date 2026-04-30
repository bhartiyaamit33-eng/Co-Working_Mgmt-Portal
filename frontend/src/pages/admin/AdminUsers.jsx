import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Check, X } from "lucide-react";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [approving, setApproving] = useState(null);
  const [approvalForm, setApprovalForm] = useState({ team_id: "", role: "member" });

  const load = useCallback(() => {
    const params = {};
    if (filterRole) params.role = filterRole;
    if (filterStatus) params.status = filterStatus;
    api.get("/admin/users", { params }).then((r) => setUsers(r.data));
  }, [filterRole, filterStatus]);

  useEffect(() => { api.get("/admin/teams").then((r) => setTeams(r.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (u) => {
    try {
      await api.post(`/admin/users/${u.id}/approve`, approvalForm);
      toast.success("Approved");
      setApproving(null); setApprovalForm({ team_id: "", role: "member" });
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const reject = async (u) => {
    const reason = window.prompt("Rejection reason?");
    if (!reason) return;
    await api.post(`/admin/users/${u.id}/reject`, { reason });
    toast.success("Rejected");
    load();
  };

  const setStatus = async (u, status) => {
    await api.put(`/admin/users/${u.id}/status`, { status });
    toast.success(`Status set to ${status}`);
    load();
  };

  return (
    <Layout title="Users" subtitle="Account management"
      actions={<button className="btn-accent" onClick={() => setShowCreate(true)} data-testid="create-user-btn"><Plus className="w-4 h-4" /> New user</button>}>
      <div className="flex flex-wrap gap-2 mb-4">
        <select className="input-field max-w-xs" value={filterRole} onChange={(e) => setFilterRole(e.target.value)} data-testid="filter-role">
          <option value="">All roles</option>
          {["super_admin", "admin", "team_lead", "member", "applicant"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input-field max-w-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="filter-status">
          <option value="">All statuses</option>
          {["pending", "active", "suspended", "inactive"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="dsse-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-left">
            <tr>
              <th className="p-4 label-eyebrow">User</th>
              <th className="p-4 label-eyebrow">Email</th>
              <th className="p-4 label-eyebrow">Role</th>
              <th className="p-4 label-eyebrow">Status</th>
              <th className="p-4 label-eyebrow">Team</th>
              <th className="p-4 label-eyebrow text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-slate-400">No users matching filters.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-t border-navy/5" data-testid={`user-row-${u.id}`}>
                <td className="p-4 text-navy font-medium">{u.first_name} {u.last_name}</td>
                <td className="p-4 text-slate-600">{u.email}</td>
                <td className="p-4 text-navy">{u.role}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${
                    u.status === "active" ? "bg-emerald-50 text-emerald-700" :
                    u.status === "pending" ? "bg-amber-50 text-amber-700" :
                    u.status === "suspended" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                  }`}>{u.status}</span>
                </td>
                <td className="p-4 text-slate-600">{u.team?.name || "—"}</td>
                <td className="p-4 text-right space-x-1">
                  {u.status === "pending" && (
                    <>
                      <button className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs" onClick={() => setApproving(u)} data-testid={`approve-user-${u.id}`}>Approve</button>
                      <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs" onClick={() => reject(u)} data-testid={`reject-user-${u.id}`}>Reject</button>
                    </>
                  )}
                  {u.status === "active" && u.role !== "super_admin" && (
                    <button className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs" onClick={() => setStatus(u, "suspended")} data-testid={`suspend-user-${u.id}`}>Suspend</button>
                  )}
                  {u.status === "suspended" && (
                    <button className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs" onClick={() => setStatus(u, "active")} data-testid={`reactivate-user-${u.id}`}>Reactivate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal teams={teams} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}

      {approving && (
        <div className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <span className="label-eyebrow">Approve applicant</span>
            <h3 className="font-serif text-xl text-navy mt-2">{approving.first_name} {approving.last_name}</h3>
            <p className="text-sm text-slate-500 mt-1">{approving.email}</p>
            <div className="space-y-3 mt-4">
              <div>
                <label className="label-eyebrow">Role</label>
                <select className="input-field mt-1" value={approvalForm.role} onChange={(e) => setApprovalForm({ ...approvalForm, role: e.target.value })} data-testid="approval-role">
                  <option value="member">Member</option>
                  <option value="team_lead">Team Lead</option>
                </select>
              </div>
              <div>
                <label className="label-eyebrow">Assign to team (optional)</label>
                <select className="input-field mt-1" value={approvalForm.team_id} onChange={(e) => setApprovalForm({ ...approvalForm, team_id: e.target.value })} data-testid="approval-team">
                  <option value="">— None —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.program})</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-outline" onClick={() => setApproving(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => approve(approving)} data-testid="confirm-approve-user">Approve</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function CreateUserModal({ teams, onClose, onCreated }) {
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", role: "member", initial_password: "", team_id: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const payload = { ...form };
      if (!payload.team_id) delete payload.team_id;
      await api.post("/admin/users", payload);
      toast.success("User created");
      onCreated();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <span className="label-eyebrow">Create new user</span>
        <h3 className="font-serif text-xl text-navy mt-2">Pre-issued credentials</h3>
        <div className="space-y-3 mt-4">
          <input className="input-field" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="cu-email" />
          <div className="grid grid-cols-2 gap-2">
            <input className="input-field" placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="cu-firstname" />
            <input className="input-field" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="cu-lastname" />
          </div>
          <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="cu-role">
            {["member", "team_lead", "admin", "super_admin"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="input-field" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} data-testid="cu-team">
            <option value="">— No team —</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="password" className="input-field" placeholder="Initial password" minLength={6} value={form.initial_password} onChange={(e) => setForm({ ...form, initial_password: e.target.value })} data-testid="cu-password" />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy} data-testid="cu-submit">{busy ? "Creating…" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

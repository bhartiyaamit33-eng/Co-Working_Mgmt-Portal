import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";

export default function AdminTeams() {
  const [teams, setTeams] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(() => api.get("/admin/teams").then((r) => setTeams(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const programLabel = { ideas_l1: "IDEAS L1", ideas_l2: "IDEAS L2", groww: "Groww", individual: "Individual" };

  return (
    <Layout title="Teams" subtitle="Venture teams"
      actions={
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => setShowImport(true)} data-testid="import-csv-btn"><Upload className="w-4 h-4" /> Import CSV</button>
          <button className="btn-accent" onClick={() => setShowCreate(true)} data-testid="create-team-btn"><Plus className="w-4 h-4" /> New team</button>
        </div>
      }>
      <div className="dsse-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-left">
            <tr>
              <th className="p-4 label-eyebrow">Name</th>
              <th className="p-4 label-eyebrow">Program</th>
              <th className="p-4 label-eyebrow">Tier</th>
              <th className="p-4 label-eyebrow">Period</th>
              <th className="p-4 label-eyebrow">Members</th>
              <th className="p-4 label-eyebrow">Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-slate-400">No teams yet.</td></tr>
            ) : teams.map((t) => (
              <tr key={t.id} className="border-t border-navy/5" data-testid={`team-row-${t.id}`}>
                <td className="p-4 text-navy font-medium">{t.name}</td>
                <td className="p-4 text-navy">{programLabel[t.program] || t.program}</td>
                <td className="p-4 text-navy">{t.priority_tier}</td>
                <td className="p-4 text-slate-600">{t.active_from} → {t.active_until}</td>
                <td className="p-4 text-navy">{t.member_count}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${t.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateTeam onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {showImport && <ImportCsv onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(); }} />}
    </Layout>
  );
}

function CreateTeam({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", program: "ideas_l1", priority_tier: 3, active_from: new Date().toISOString().slice(0, 10), active_until: "" });
  const submit = async () => {
    try {
      await api.post("/admin/teams", form);
      toast.success("Team created");
      onCreated();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <Modal title="Create team" onClose={onClose}>
      <div className="space-y-3">
        <input className="input-field" placeholder="Team name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="ct-name" />
        <select className="input-field" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} data-testid="ct-program">
          <option value="ideas_l1">IDEAS Level 1</option>
          <option value="ideas_l2">IDEAS Level 2</option>
          <option value="groww">Groww</option>
          <option value="individual">Individual</option>
        </select>
        <input type="number" className="input-field" placeholder="Priority tier (1=high)" value={form.priority_tier} onChange={(e) => setForm({ ...form, priority_tier: parseInt(e.target.value) })} data-testid="ct-tier" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="input-field" value={form.active_from} onChange={(e) => setForm({ ...form, active_from: e.target.value })} data-testid="ct-from" />
          <input type="date" className="input-field" value={form.active_until} onChange={(e) => setForm({ ...form, active_until: e.target.value })} data-testid="ct-until" />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} data-testid="ct-submit">Create</button>
      </div>
    </Modal>
  );
}

function ImportCsv({ onClose, onImported }) {
  const ref = useRef();
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);

  const upload = async (dryRun) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post(`/admin/teams/import?dry_run=${dryRun}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    setPreview(data);
    if (!dryRun) { toast.success(`Imported ${data.created} team(s)`); onImported(); }
  };

  return (
    <Modal title="Import teams from CSV" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-3">Required columns: <code className="text-xs">name, program, priority_tier, active_from, active_until</code></p>
      <input type="file" accept=".csv" ref={ref} onChange={(e) => { setFile(e.target.files[0]); setPreview(null); }} data-testid="csv-file-input" className="text-sm" />
      <div className="flex gap-2 mt-3">
        <button className="btn-outline" disabled={!file} onClick={() => upload(true)} data-testid="csv-dryrun-btn">Preview</button>
        {preview && preview.preview && <button className="btn-accent" onClick={() => upload(false)} data-testid="csv-confirm-btn">Confirm import ({preview.preview.length})</button>}
      </div>
      {preview && (
        <div className="mt-4 max-h-64 overflow-y-auto text-xs">
          {preview.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-2">
              {preview.errors.map((e) => <div key={`err-${e}`}>{e}</div>)}
            </div>
          )}
          {preview.preview?.length > 0 && (
            <table className="w-full">
              <thead><tr className="text-slate-500"><th className="text-left">Name</th><th className="text-left">Program</th><th>Tier</th><th>From</th><th>Until</th></tr></thead>
              <tbody>{preview.preview.map((r) => <tr key={`prev-${r.name}`} className="border-t border-slate-100"><td>{r.name}</td><td>{r.program}</td><td className="text-center">{r.priority_tier}</td><td>{r.active_from}</td><td>{r.active_until}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-serif text-xl text-navy mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

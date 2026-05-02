import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { formatRequestError } from "@/lib/api";
import { Markdown } from "@/pages/GuidelinesPublic";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function AdminGuidelines() {
  const [list, setList] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => api.get("/admin/guidelines").then((r) => setList(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const activate = async (id) => {
    await api.post(`/admin/guidelines/${id}/activate`);
    toast.success("Activated");
    load();
  };

  return (
    <Layout title="Guidelines" subtitle="Versioned policy"
      actions={<button className="btn-accent" onClick={() => setShowCreate(true)} data-testid="new-guidelines-btn"><Plus className="w-4 h-4" /> New version</button>}>
      <div className="space-y-4">
        {list.length === 0 ? (
          <div className="dsse-card p-12 text-center text-slate-400">No versions yet.</div>
        ) : list.map((g) => (
          <div key={g.id} className="dsse-card p-6" data-testid={`guideline-${g.id}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="label-eyebrow text-amber-700">Version {g.version}</span>
                <h3 className="font-serif text-xl text-navy mt-1">{g.active ? "Active" : "Archived"}</h3>
                <p className="text-xs text-slate-500 mt-1">Created {new Date(g.created_at).toLocaleString("en-IN")}</p>
              </div>
              {!g.active && <button className="btn-outline" onClick={() => activate(g.id)} data-testid={`activate-${g.id}`}>Activate</button>}
              {g.active && <span className="inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-emerald-50 text-emerald-700">Active</span>}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-amber-700 hover:text-amber-800">Show content</summary>
              <div className="mt-3 prose-sm max-w-none">
                <Markdown text={g.content_md} />
              </div>
            </details>
          </div>
        ))}
      </div>

      {showCreate && <CreateGuidelines onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </Layout>
  );
}

function CreateGuidelines({ onClose, onCreated }) {
  const [form, setForm] = useState({ content_md: "", activate: true });
  const submit = async () => {
    try {
      await api.post("/admin/guidelines", form);
      toast.success("Guidelines created");
      onCreated();
    } catch (e) { toast.error(formatRequestError(e)); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col">
        <h3 className="font-serif text-xl text-navy mb-4">New guidelines version</h3>
        <textarea className="input-field flex-1 min-h-[400px] font-mono text-xs" placeholder="# Title&#10;## Section&#10;- bullet"
          value={form.content_md} onChange={(e) => setForm({ ...form, content_md: e.target.value })} data-testid="cg-content" />
        <label className="mt-3 inline-flex items-center gap-2 text-sm text-navy">
          <input type="checkbox" checked={form.activate} onChange={(e) => setForm({ ...form, activate: e.target.checked })} data-testid="cg-activate" />
          Activate immediately (members will be asked to re-accept)
        </label>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} data-testid="cg-submit">Save</button>
        </div>
      </div>
    </div>
  );
}

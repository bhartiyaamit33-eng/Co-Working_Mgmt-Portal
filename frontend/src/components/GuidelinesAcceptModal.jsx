import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Markdown } from "@/pages/GuidelinesPublic";
import { X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function GuidelinesAcceptModal() {
  const { user, refreshMe } = useAuth();
  const [g, setG] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !user.id) return;
    api.get("/guidelines/active").then((r) => {
      const active = r.data;
      setG(active);
      if (active && user.guidelines_accepted_version !== active.version) {
        setOpen(true);
      }
    });
  }, [user]);

  const accept = async () => {
    await api.post("/auth/accept-guidelines", { guidelines_id: g.id });
    await refreshMe();
    setOpen(false);
    toast.success("Guidelines accepted");
  };

  if (!open || !g) return null;
  return (
    <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="guidelines-modal">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-6 border-b border-navy/10">
          <div className="flex gap-3">
            <ShieldCheck className="w-6 h-6 text-amber-600 mt-1" />
            <div>
              <span className="label-eyebrow text-amber-700">Version {g.version}</span>
              <h2 className="font-serif text-2xl text-navy mt-1">Accept the guidelines</h2>
              <p className="text-sm text-slate-500 mt-1">You must accept the latest version before booking a seat.</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 prose-sm">
          <Markdown text={g.content_md} />
        </div>
        <div className="p-6 border-t border-navy/10 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setOpen(false)} data-testid="guidelines-defer-btn">Later</button>
          <button className="btn-primary" onClick={accept} data-testid="guidelines-accept-btn">I accept</button>
        </div>
      </div>
    </div>
  );
}

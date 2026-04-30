import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "./Login";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [token, setToken] = useState(params.get("token") || "");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api.post("/auth/reset-password", { token, new_password: pwd });
      toast.success("Password updated. Please log in.");
      nav("/login");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Choose a new password" subtitle="Reset password">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="reset-form">
        <div>
          <label className="label-eyebrow">Reset token</label>
          <input required value={token} onChange={(e) => setToken(e.target.value)} className="input-field mt-1 font-mono text-xs" data-testid="reset-token-input" />
        </div>
        <div>
          <label className="label-eyebrow">New password (min 6)</label>
          <input type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} className="input-field mt-1" data-testid="reset-password-input" />
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="reset-submit-btn">
          {busy ? "Updating…" : "Update password"}
        </button>
        <Link to="/login" className="text-sm text-slate-500 block text-center pt-2">Back to login</Link>
      </form>
    </AuthShell>
  );
}

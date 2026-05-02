import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "./Login";
import api, { formatRequestError } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      if (data.reset_token) setToken(data.reset_token);
      toast.success("If the email exists, a reset link has been sent.");
    } catch (e) {
      setErr(formatRequestError(e));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Forgot password">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="forgot-form">
        <div>
          <label className="label-eyebrow">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field mt-1" data-testid="forgot-email-input" />
        </div>
        {token && (
          <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-xs text-navy">
            Dev mode: reset token is shown below. Use it on the reset page.
            <div className="mt-2 font-mono break-all">{token}</div>
            <Link to={`/reset-password?token=${token}`} className="text-amber-700 underline mt-2 block" data-testid="forgot-reset-link">Continue to reset →</Link>
          </div>
        )}
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="forgot-submit-btn">
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <Link to="/login" className="text-sm text-slate-500 block text-center pt-2" data-testid="forgot-back-login">Back to login</Link>
      </form>
    </AuthShell>
  );
}

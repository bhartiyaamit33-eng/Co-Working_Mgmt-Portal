import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatRequestError } from "@/lib/auth";
import { loginEmailError } from "@/lib/email";
import { AuthShell } from "./Login";
import { toast } from "sonner";

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", roll_number: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    const domainErr = loginEmailError(form.email);
    if (domainErr) { setErr(domainErr); return; }
    setBusy(true); setErr("");
    try {
      await signup(form);
      setDone(true);
      toast.success("Application submitted!");
    } catch (e) {
      setErr(formatRequestError(e));
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <AuthShell title="Application submitted" subtitle="Awaiting review">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm text-navy">
              We've received your application. A program admin will review it shortly.
              You'll receive a notification when your account is approved.
            </p>
          </div>
          <Link to="/login" className="btn-primary w-full" data-testid="signup-back-login">Back to login</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Apply for access" subtitle="New applicant">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="signup-form">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-eyebrow">First name</label>
            <input required value={form.first_name} onChange={update("first_name")} className="input-field mt-1" data-testid="signup-firstname-input" />
          </div>
          <div>
            <label className="label-eyebrow">Last name</label>
            <input required value={form.last_name} onChange={update("last_name")} className="input-field mt-1" data-testid="signup-lastname-input" />
          </div>
        </div>
        <div>
          <label className="label-eyebrow">IIT Bombay email</label>
          <input type="email" required value={form.email} onChange={update("email")} className="input-field mt-1" placeholder="you@iitb.ac.in" data-testid="signup-email-input" />
          <p className="text-[11px] text-slate-500 mt-1">Must be an @iitb.ac.in address. Gmail is not accepted for team accounts.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-eyebrow">Roll number</label>
            <input value={form.roll_number} onChange={update("roll_number")} className="input-field mt-1" data-testid="signup-roll-input" />
          </div>
          <div>
            <label className="label-eyebrow">Phone</label>
            <input value={form.phone} onChange={update("phone")} className="input-field mt-1" data-testid="signup-phone-input" />
          </div>
        </div>
        <div>
          <label className="label-eyebrow">Password (min 6)</label>
          <input type="password" required minLength={6} value={form.password} onChange={update("password")} className="input-field mt-1" data-testid="signup-password-input" />
        </div>
        {err && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200" data-testid="signup-error">{err}</div>}
        <button type="submit" disabled={busy} className="btn-accent w-full" data-testid="signup-submit-btn">
          {busy ? "Submitting…" : "Submit application"}
        </button>
        <div className="text-center text-sm text-slate-500 pt-2">
          Already have an account? <Link to="/login" className="text-amber-700 font-medium" data-testid="signup-login-link">Log in</Link>
        </div>
      </form>
    </AuthShell>
  );
}

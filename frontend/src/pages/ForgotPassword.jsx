import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "./Login";
import api, { formatRequestError } from "@/lib/api";
import { loginEmailError } from "@/lib/email";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sendCode = async (e) => {
    e.preventDefault();
    const domainErr = loginEmailError(email);
    if (domainErr) { setErr(domainErr); return; }
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/auth/request-otp", { email, purpose: "reset" });
      if (data.otp) {
        setDevOtp(data.otp);
        setOtp(data.otp);
      }
      setSent(true);
      toast.success(
        data.delivered
          ? "A reset code was sent to your email."
          : data.otp
            ? "Email is not sending yet — use the code shown below."
            : "If this account exists, a reset code is ready."
      );
    } catch (e) {
      setErr(formatRequestError(e));
    } finally { setBusy(false); }
  };

  const resetWithOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setErr("Enter the 6-digit code from your email."); return; }
    setBusy(true); setErr("");
    try {
      await api.post("/auth/reset-password-otp", { email, otp, new_password: password });
      toast.success("Password updated. Please log in.");
      nav("/login");
    } catch (e) {
      setErr(formatRequestError(e));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Email code">
      <form onSubmit={sent ? resetWithOtp : sendCode} className="space-y-4" data-testid="forgot-form">
        <div>
          <label className="label-eyebrow">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field mt-1" placeholder="you@iitb.ac.in" data-testid="forgot-email-input" />
        </div>
        {sent && (
          <>
            <div>
              <label className="label-eyebrow">One-time code</label>
              <div className="mt-2">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="h-11 w-11 text-base border-navy/15" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <div>
              <label className="label-eyebrow">New password (min 6)</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input-field mt-1" data-testid="forgot-new-password" />
            </div>
          </>
        )}
        {devOtp && (
          <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-sm text-navy" data-testid="forgot-otp-fallback">
            Email is not sending yet. Your code is <span className="font-mono font-semibold tracking-widest">{devOtp}</span>
          </div>
        )}
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="forgot-submit-btn">
          {busy ? "Please wait…" : sent ? "Update password" : "Send reset code"}
        </button>
        <Link to="/login" className="text-sm text-slate-500 block text-center pt-2" data-testid="forgot-back-login">Back to login</Link>
      </form>
    </AuthShell>
  );
}

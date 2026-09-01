import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, formatRequestError } from "@/lib/auth";
import api from "@/lib/api";
import { loginEmailError } from "@/lib/email";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Login() {
  const { login, loginWithOtp } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const msg = params.get("msg");

  const finishLogin = (u) => {
    if (!u) throw new Error("Login incomplete.");
    if (["super_admin", "admin"].includes(u.role)) nav("/admin");
    else nav("/dashboard");
    toast.success("Welcome back.");
  };

  const onPasswordSubmit = async (e) => {
    e.preventDefault();
    const domainErr = loginEmailError(email);
    if (domainErr) { setErr(domainErr); return; }
    setBusy(true); setErr("");
    try {
      finishLogin(await login(email, password));
    } catch (e) {
      setErr(formatRequestError(e));
    } finally { setBusy(false); }
  };

  const sendOtp = async (e) => {
    e.preventDefault();
    const domainErr = loginEmailError(email);
    if (domainErr) { setErr(domainErr); return; }
    setBusy(true); setErr(""); setDevOtp("");
    try {
      const { data } = await api.post("/auth/request-otp", { email, purpose: "login" });
      if (data.otp) setDevOtp(data.otp);
      toast.success(data.delivered ? "A login code was sent to your email." : "If this account exists, a login code is ready.");
    } catch (e) {
      setErr(formatRequestError(e));
    } finally { setBusy(false); }
  };

  const onOtpSubmit = async (e) => {
    e.preventDefault();
    const domainErr = loginEmailError(email);
    if (domainErr) { setErr(domainErr); return; }
    if (otp.length !== 6) { setErr("Enter the 6-digit code from your email."); return; }
    setBusy(true); setErr("");
    try {
      finishLogin(await loginWithOtp(email, otp));
    } catch (e) {
      setErr(formatRequestError(e));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your account">
      <div className="mb-5 p-3 rounded-xl bg-navy/5 text-xs text-navy/80 leading-relaxed">
        Team leads and members sign in with an <span className="font-medium">@iitb.ac.in</span> email.
        Admin access is limited to <span className="font-medium">ideas.iitb@gmail.com</span>.
      </div>
      <div className="inline-flex bg-navy/5 rounded-xl p-1 mb-5" role="tablist">
        <button type="button" onClick={() => { setMode("password"); setErr(""); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "password" ? "bg-white text-navy shadow-sm" : "text-navy/60"}`}
          data-testid="login-mode-password">Password</button>
        <button type="button" onClick={() => { setMode("otp"); setErr(""); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "otp" ? "bg-white text-navy shadow-sm" : "text-navy/60"}`}
          data-testid="login-mode-otp">Email code</button>
      </div>

      {msg === "pending" && (
        <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-sm text-navy mb-4">
          Your account is pending admin approval. You'll receive a notification once reviewed.
        </div>
      )}

      {mode === "password" ? (
        <form onSubmit={onPasswordSubmit} className="space-y-4" data-testid="login-form">
          <EmailField email={email} setEmail={setEmail} />
          <div>
            <label className="label-eyebrow">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="input-field mt-1" data-testid="login-password-input" />
          </div>
          {err && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200" data-testid="login-error">{err}</div>}
          <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="login-submit-btn">
            {busy ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      ) : (
        <form onSubmit={devOtp || otp ? onOtpSubmit : sendOtp} className="space-y-4" data-testid="login-otp-form">
          <EmailField email={email} setEmail={setEmail} />
          <div>
            <label className="label-eyebrow">One-time code</label>
            <div className="mt-2">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} data-testid="login-otp-input">
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-11 w-11 text-base border-navy/15" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          {devOtp && (
            <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-xs text-navy">
              Email delivery is not configured locally. Your code is <span className="font-mono font-semibold">{devOtp}</span>
            </div>
          )}
          {err && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200" data-testid="login-error">{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={sendOtp} className="btn-outline w-full" data-testid="login-send-otp-btn">
              {busy ? "Sending…" : "Send code"}
            </button>
            <button type="submit" disabled={busy || otp.length !== 6} className="btn-primary w-full" data-testid="login-verify-otp-btn">
              {busy ? "Signing in…" : "Verify"}
            </button>
          </div>
        </form>
      )}

      <div className="flex justify-between text-sm pt-4">
        <Link to="/forgot-password" className="text-slate-500 hover:text-navy" data-testid="forgot-password-link">Forgot password?</Link>
        <Link to="/signup" className="text-amber-700 hover:text-amber-800 font-medium" data-testid="login-signup-link">Apply for access →</Link>
      </div>
    </AuthShell>
  );
}

function EmailField({ email, setEmail }) {
  return (
    <div>
      <label className="label-eyebrow">Email</label>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        className="input-field mt-1" placeholder="you@iitb.ac.in" data-testid="login-email-input" />
    </div>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-navy items-end p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'url(https://images.pexels.com/photos/14902046/pexels-photo-14902046.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)',
          backgroundSize: 'cover', backgroundPosition: 'center'
        }} />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-navy/30" />
        <div className="relative z-10 text-white max-w-md">
          <span className="label-eyebrow text-amber-400">DSSE · IIT Bombay</span>
          <h2 className="font-serif text-4xl mt-2 leading-tight">A focused workspace for ventures that mean it.</h2>
          <p className="text-white/70 mt-4 text-sm leading-relaxed">
            55 workstations on the 4th floor of the DSSE Building. Reserved by program teams,
            moderated by faculty.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Logo to="/" size="h-10" className="mb-12" />
          <span className="label-eyebrow text-amber-700">{subtitle}</span>
          <h1 className="font-serif text-3xl sm:text-4xl text-navy mt-2 mb-8">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

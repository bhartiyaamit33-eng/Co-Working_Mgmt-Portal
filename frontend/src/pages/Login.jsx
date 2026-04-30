import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, formatApiErrorDetail } from "@/lib/auth";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const msg = params.get("msg");

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const u = await login(email, password);
      if (!u) throw new Error("Login failed");
      if (["super_admin", "admin"].includes(u.role)) nav("/admin");
      else nav("/dashboard");
      toast.success("Welcome back.");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your account">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
        {msg === "pending" && (
          <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-sm text-navy">
            Your account is pending admin approval. You'll receive a notification once reviewed.
          </div>
        )}
        <div>
          <label className="label-eyebrow">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="input-field mt-1" placeholder="you@iitb.ac.in" data-testid="login-email-input" />
        </div>
        <div>
          <label className="label-eyebrow">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="input-field mt-1" data-testid="login-password-input" />
        </div>
        {err && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200" data-testid="login-error">{err}</div>}
        <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="login-submit-btn">
          {busy ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
        </button>
        <div className="flex justify-between text-sm pt-2">
          <Link to="/forgot-password" className="text-slate-500 hover:text-navy" data-testid="forgot-password-link">Forgot password?</Link>
          <Link to="/signup" className="text-amber-700 hover:text-amber-800 font-medium" data-testid="login-signup-link">Apply for access →</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
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
      {/* Right form */}
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

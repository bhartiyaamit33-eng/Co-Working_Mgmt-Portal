import { useState } from "react";
import Layout from "@/components/Layout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Profile() {
  const { user, refreshMe } = useAuth();
  const [form, setForm] = useState({ first_name: user?.first_name || "", last_name: user?.last_name || "", phone: user?.phone || "" });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "" });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/profile", form);
      await refreshMe();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const changePwd = async () => {
    setBusy(true);
    try {
      await api.post("/profile/change-password", pwd);
      setPwd({ current_password: "", new_password: "" });
      toast.success("Password changed");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <Layout title="My profile" subtitle="Account settings">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="dsse-card p-6">
          <span className="label-eyebrow">Personal info</span>
          <div className="space-y-3 mt-4">
            <div>
              <label className="text-xs text-slate-500">Email</label>
              <div className="text-sm text-navy mt-1 font-mono">{user?.email}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-eyebrow">First name</label>
                <input className="input-field mt-1" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="profile-firstname" />
              </div>
              <div>
                <label className="label-eyebrow">Last name</label>
                <input className="input-field mt-1" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="profile-lastname" />
              </div>
            </div>
            <div>
              <label className="label-eyebrow">Phone</label>
              <input className="input-field mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="profile-phone" />
            </div>
            <button className="btn-primary mt-2" disabled={busy} onClick={save} data-testid="profile-save-btn">{busy ? "Saving…" : "Save changes"}</button>
          </div>
        </div>

        <div className="dsse-card p-6">
          <span className="label-eyebrow">Change password</span>
          <div className="space-y-3 mt-4">
            <div>
              <label className="label-eyebrow">Current password</label>
              <input type="password" className="input-field mt-1" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} data-testid="pwd-current" />
            </div>
            <div>
              <label className="label-eyebrow">New password</label>
              <input type="password" minLength={6} className="input-field mt-1" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} data-testid="pwd-new" />
            </div>
            <button className="btn-primary mt-2" disabled={busy} onClick={changePwd} data-testid="pwd-change-btn">Change password</button>
          </div>
          <div className="mt-6 pt-6 border-t border-navy/10">
            <span className="label-eyebrow">Account</span>
            <div className="mt-2 text-sm text-slate-600">
              <div>Role: <span className="font-medium text-navy">{user?.role}</span></div>
              <div>Status: <span className="font-medium text-navy">{user?.status}</span></div>
              <div>Guidelines version accepted: {user?.guidelines_accepted_version || "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

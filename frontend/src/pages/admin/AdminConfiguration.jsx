import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api, { formatRequestError } from "@/lib/api";
import { toast } from "sonner";

export default function AdminConfiguration() {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadCfg = useCallback(async () => {
    const { data } = await api.get("/configuration");
    setCfg(data);
  }, []);

  useEffect(() => { loadCfg(); }, [loadCfg]);

  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.type === "number" ? parseInt(e.target.value) : e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/configuration", {
        working_hours_start: cfg.working_hours_start,
        working_hours_end: cfg.working_hours_end,
        daily_cap_hours: cfg.daily_cap_hours,
        weekly_cap_hours: cfg.weekly_cap_hours,
        lead_time_hours: cfg.lead_time_hours,
        booking_window_days: cfg.booking_window_days,
        max_booking_hours: cfg.max_booking_hours,
        min_booking_hours: cfg.min_booking_hours,
        auto_approve_programs: cfg.auto_approve_programs,
      });
      toast.success("Configuration saved");
    } catch (e) { toast.error(formatRequestError(e)); }
    finally { setBusy(false); }
  };

  if (!cfg) return <Layout title="Configuration"><div className="text-slate-400">Loading…</div></Layout>;

  const programs = ["ideas_l1", "ideas_l2", "groww", "individual"];
  const toggleProg = (p) => {
    const list = cfg.auto_approve_programs || [];
    setCfg({ ...cfg, auto_approve_programs: list.includes(p) ? list.filter((x) => x !== p) : [...list, p] });
  };

  return (
    <Layout title="Configuration" subtitle="Booking rules">
      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Working hours">
          <Field label="Start hour (24h)"><input type="number" min={0} max={23} className="input-field" value={cfg.working_hours_start} onChange={set("working_hours_start")} data-testid="cfg-start" /></Field>
          <Field label="End hour (24h)"><input type="number" min={1} max={24} className="input-field" value={cfg.working_hours_end} onChange={set("working_hours_end")} data-testid="cfg-end" /></Field>
        </Section>
        <Section title="Quotas (per team)">
          <Field label="Daily cap (hours)"><input type="number" min={1} className="input-field" value={cfg.daily_cap_hours} onChange={set("daily_cap_hours")} data-testid="cfg-daily" /></Field>
          <Field label="Weekly cap (hours)"><input type="number" min={1} className="input-field" value={cfg.weekly_cap_hours} onChange={set("weekly_cap_hours")} data-testid="cfg-weekly" /></Field>
        </Section>
        <Section title="Per-booking limits">
          <Field label="Min booking (hours)"><input type="number" min={1} className="input-field" value={cfg.min_booking_hours} onChange={set("min_booking_hours")} data-testid="cfg-min" /></Field>
          <Field label="Max booking (hours)"><input type="number" min={1} className="input-field" value={cfg.max_booking_hours} onChange={set("max_booking_hours")} data-testid="cfg-max" /></Field>
        </Section>
        <Section title="Booking window">
          <Field label="Lead time (hours)"><input type="number" min={0} className="input-field" value={cfg.lead_time_hours} onChange={set("lead_time_hours")} data-testid="cfg-lead" /></Field>
          <Field label="Window (days ahead)"><input type="number" min={1} className="input-field" value={cfg.booking_window_days} onChange={set("booking_window_days")} data-testid="cfg-window" /></Field>
        </Section>
        <Section title="Auto-approve programs">
          <p className="text-xs text-slate-500 mb-2">Bookings from these programs are approved automatically.</p>
          <div className="flex flex-wrap gap-2">
            {programs.map((p) => {
              const on = (cfg.auto_approve_programs || []).includes(p);
              return (
                <button key={p} onClick={() => toggleProg(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${on ? "bg-amber/15 border-amber text-navy" : "border-navy/15 text-navy/60 hover:border-amber/40"}`}
                  data-testid={`auto-approve-${p}`}>
                  {p.replace("_", " ").toUpperCase()} {on ? "✓" : ""}
                </button>
              );
            })}
          </div>
        </Section>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="btn-accent" disabled={busy} onClick={save} data-testid="cfg-save-btn">{busy ? "Saving…" : "Save configuration"}</button>
      </div>
    </Layout>
  );
}

function Section({ title, children }) {
  return (
    <div className="dsse-card p-6">
      <span className="label-eyebrow">{title}</span>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

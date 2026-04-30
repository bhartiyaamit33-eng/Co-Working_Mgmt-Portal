import { Fragment, useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Download } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";

export default function AdminReports() {
  const [util, setUtil] = useState(null);
  const [team, setTeam] = useState([]);

  const loadReports = useCallback(async () => {
    const [u, t] = await Promise.all([
      api.get("/admin/reports/utilization"),
      api.get("/admin/reports/team-usage"),
    ]);
    setUtil(u.data);
    setTeam(t.data);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const exportCsv = async () => {
    const { data } = await api.get("/admin/reports/export");
    const blob = new Blob([data.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dsse-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const maxHeat = util ? Math.max(0, ...Object.values(util.matrix || {})) : 1;

  return (
    <Layout title="Reports" subtitle="Analytics & insights"
      actions={<button className="btn-accent" onClick={exportCsv} data-testid="export-csv-btn"><Download className="w-4 h-4" /> Export CSV</button>}>
      <div className="dsse-card p-6 mb-6">
        <span className="label-eyebrow">Team usage · last 30 days (hours)</span>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={team}>
              <XAxis dataKey="team" tick={{ fontSize: 11, fill: "#1B2A4E" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8A94A6" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(27,42,78,0.1)", fontSize: 12 }} />
              <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                {team.map((_, i) => <Cell key={i} fill={i % 2 ? "#1B2A4E" : "#E8A33D"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dsse-card p-6">
        <span className="label-eyebrow">Seat × hour utilization heatmap (30d)</span>
        {util && (
          <div className="mt-4 overflow-x-auto">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `40px repeat(${util.hours.length}, 1fr)` }}>
              <div></div>
              {util.hours.map((h) => <div key={h} className="text-[10px] text-slate-500 text-center">{h}</div>)}
              {Array.from({ length: 55 }, (_, i) => i + 1).map((sid) => (
                <Fragment key={`heatmap-row-${sid}`}>
                  <div className="text-[10px] text-slate-500 text-right pr-1">#{sid}</div>
                  {util.hours.map((h) => {
                    const v = util.matrix[`${sid}-${h}`] || 0;
                    const intensity = maxHeat > 0 ? v / maxHeat : 0;
                    const bg = intensity === 0 ? "rgba(27,42,78,0.04)" : `rgba(232,163,61,${0.15 + intensity * 0.85})`;
                    return <div key={`${sid}-${h}`} className="h-5 rounded-sm" style={{ background: bg }} title={`Seat ${sid}, ${h}:00 — ${v} bookings`} />;
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

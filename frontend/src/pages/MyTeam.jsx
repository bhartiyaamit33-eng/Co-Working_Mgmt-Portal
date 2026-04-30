import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Users } from "lucide-react";
import { BookingRow } from "./Dashboard";

export default function MyTeam() {
  const { team } = useAuth();
  const [data, setData] = useState(null);

  const loadTeam = useCallback(async (teamId) => {
    const { data: d } = await api.get(`/teams/${teamId}`);
    setData(d);
  }, []);

  useEffect(() => {
    if (team) loadTeam(team.id);
  }, [team, loadTeam]);

  if (!team) return (
    <Layout title="My team" subtitle="Team overview">
      <div className="dsse-card p-12 text-center">
        <Users className="w-10 h-10 text-navy/20 mx-auto mb-3" />
        <p className="text-slate-500">You aren't assigned to a team yet. Contact your program admin.</p>
      </div>
    </Layout>
  );

  const usagePct = data ? Math.min(100, (data.weekly_hours / 20) * 100) : 0;

  return (
    <Layout title={team.name} subtitle={team.program?.replace("_", " ").toUpperCase()}>
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="dsse-card p-6 lg:col-span-2">
          <span className="label-eyebrow">Weekly usage</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-serif text-4xl text-navy">{data?.weekly_hours || 0}</span>
            <span className="text-slate-400">/ 20h this week</span>
          </div>
          <div className="mt-4 h-2 bg-navy/5 rounded-full overflow-hidden">
            <div className="h-full bg-amber rounded-full" style={{ width: `${usagePct}%` }} />
          </div>
        </div>
        <div className="dsse-card p-6">
          <span className="label-eyebrow">Active period</span>
          <div className="text-sm text-navy mt-2">{team.active_from}</div>
          <div className="text-xs text-slate-500">to {team.active_until}</div>
          <div className="mt-3 inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">Tier {team.priority_tier}</div>
        </div>
      </div>

      <div className="dsse-card p-6 mb-6">
        <span className="label-eyebrow">Members ({data?.members?.length || 0})</span>
        <div className="mt-3 divide-y divide-navy/5">
          {data?.members?.map((m) => (
            <div key={m.id} className="py-3 flex justify-between items-center" data-testid={`team-member-${m.id}`}>
              <div>
                <div className="font-medium text-navy">{m.first_name} {m.last_name}</div>
                <div className="text-xs text-slate-500">{m.email} · {m.role_in_team}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">{m.role}</span>
            </div>
          )) || <div className="text-sm text-slate-400 py-3">No members yet</div>}
        </div>
      </div>

      <div className="dsse-card p-6">
        <span className="label-eyebrow">Team's upcoming bookings</span>
        <div className="mt-3 space-y-2">
          {(data?.upcoming || []).length === 0 ? (
            <div className="text-sm text-slate-400 py-3">No upcoming bookings.</div>
          ) : data.upcoming.map((b) => <BookingRow key={b.id} b={b} />)}
        </div>
      </div>
    </Layout>
  );
}

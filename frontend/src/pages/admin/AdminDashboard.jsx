import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Users, AlertTriangle, TrendingUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/dashboard").then((r) => setData(r.data));
  }, []);

  const kpis = [
    { label: "Today's bookings", value: data?.today_bookings ?? "—", icon: Calendar, link: "/admin/approvals" },
    { label: "Occupancy", value: data ? `${data.occupancy}%` : "—", icon: TrendingUp },
    { label: "Pending approvals", value: data?.pending_bookings ?? "—", icon: Users, badge: data?.pending_bookings > 0, link: "/admin/approvals" },
    { label: "Violations / month", value: data?.violations_this_month ?? "—", icon: AlertTriangle, link: "/admin/violations" },
  ];

  return (
    <Layout title="Admin overview" subtitle="Operations dashboard">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => {
          const Inner = (
            <div className={`dsse-card p-6 dsse-card-hover relative h-full`} data-testid={`kpi-${k.label.replace(/\s+/g, "-").toLowerCase()}`}>
              {k.badge && <span className="absolute top-3 right-3 w-2 h-2 bg-amber rounded-full" />}
              <div className="flex justify-between items-start mb-3">
                <span className="label-eyebrow">{k.label}</span>
                <k.icon className="w-4 h-4 text-amber-600" strokeWidth={1.5} />
              </div>
              <div className="font-serif text-3xl text-navy">{k.value}</div>
            </div>
          );
          return k.link ? <Link key={k.label} to={k.link}>{Inner}</Link> : <div key={k.label}>{Inner}</div>;
        })}
      </div>

      <div className="dsse-card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="label-eyebrow">Bookings · last 14 days</span>
          {data?.pending_users > 0 && (
            <Link to="/admin/users" className="text-xs text-amber-700 inline-flex items-center gap-1" data-testid="link-pending-users">
              {data.pending_users} pending applicant(s) <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.chart_14d || []}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8A94A6" }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "#8A94A6" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(27,42,78,0.1)", fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#1B2A4E" strokeWidth={2} dot={{ fill: "#E8A33D", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/admin/approvals" className="dsse-card p-6 dsse-card-hover" data-testid="card-approvals">
          <span className="label-eyebrow">Booking approvals</span>
          <h3 className="font-serif text-xl text-navy mt-2">Review & approve booking requests</h3>
          <span className="inline-flex items-center text-amber-700 text-sm mt-3">Open queue <ArrowRight className="w-3.5 h-3.5 ml-1" /></span>
        </Link>
        <Link to="/admin/users" className="dsse-card p-6 dsse-card-hover" data-testid="card-users">
          <span className="label-eyebrow">User management</span>
          <h3 className="font-serif text-xl text-navy mt-2">Approve applicants & manage roles</h3>
          <span className="inline-flex items-center text-amber-700 text-sm mt-3">Manage users <ArrowRight className="w-3.5 h-3.5 ml-1" /></span>
        </Link>
      </div>
    </Layout>
  );
}

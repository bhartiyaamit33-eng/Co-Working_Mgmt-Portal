import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Logo from "@/components/Logo";
import { Bell, LogOut, User, Calendar, Users, LayoutDashboard, MapPin, Settings, ShieldAlert, FileText, BarChart3, ChevronDown, Menu, X } from "lucide-react";

const memberNav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/book", label: "Book a Seat", icon: MapPin },
  { to: "/bookings", label: "My Bookings", icon: Calendar },
  { to: "/team", label: "My Team", icon: Users },
];
const adminNav = [
  { to: "/admin", label: "Admin Home", icon: LayoutDashboard },
  { to: "/admin/approvals", label: "Approvals", icon: ShieldAlert },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/teams", label: "Teams", icon: Users },
  { to: "/admin/seats", label: "Seats", icon: MapPin },
  { to: "/admin/violations", label: "Violations", icon: ShieldAlert },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/guidelines", label: "Guidelines", icon: FileText },
  { to: "/admin/configuration", label: "Configuration", icon: Settings },
];

export default function Layout({ children, title, subtitle, actions }) {
  const { user, team, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [notifs, setNotifs] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const isAdmin = user && ["super_admin", "admin"].includes(user.role);
  const items = isAdmin && location.pathname.startsWith("/admin") ? adminNav : memberNav;
  const unread = notifs.filter((n) => !n.read).length;

  const loadNotifs = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("notifications fetch failed:", e);
    }
  }, []);
  useEffect(() => { if (user) loadNotifs(); }, [user, loadNotifs]);

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    loadNotifs();
  };

  const onLogout = async () => { await logout(); nav("/"); };

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-offwhite/80 backdrop-blur-xl border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileNav(!mobileNav)} data-testid="mobile-nav-toggle">
              {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2" data-testid="brand-logo-link">
              <Logo to={null} size="h-9" showText />
            </Link>
            {team && (
              <span className="hidden md:inline-flex items-center ml-4 px-2.5 py-1 rounded-md bg-navy/5 text-xs text-navy/80">
                {team.name} · <span className="ml-1 uppercase tracking-wider">{team.program?.replace("_"," ")}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to={location.pathname.startsWith("/admin") ? "/dashboard" : "/admin"} className="hidden sm:inline-flex btn-outline px-3 py-1.5 text-xs" data-testid="switch-mode-btn">
                {location.pathname.startsWith("/admin") ? "Member view" : "Admin view"}
              </Link>
            )}
            <div className="relative">
              <button onClick={() => setShowNotif(!showNotif)} className="relative p-2 rounded-xl hover:bg-navy/5" data-testid="notifications-btn">
                <Bell className="w-5 h-5 text-navy" />
                {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-amber rounded-full" />}
              </button>
              {showNotif && (
                <div className="absolute right-0 mt-2 w-80 dsse-card p-3 max-h-96 overflow-y-auto">
                  <div className="flex justify-between items-center mb-2">
                    <span className="label-eyebrow">Notifications</span>
                    <button onClick={markAllRead} className="text-[10px] text-navy/60 hover:text-navy" data-testid="mark-all-read">Mark all read</button>
                  </div>
                  {notifs.length === 0 ? (
                    <div className="py-6 text-center text-sm text-slate-400">No notifications yet</div>
                  ) : notifs.slice(0, 12).map((n) => (
                    <div key={n.id} className={`p-2.5 rounded-lg mb-1.5 border ${n.read ? "border-transparent" : "border-amber/40 bg-amber/5"}`}>
                      <div className="text-sm font-medium text-navy">{n.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link to="/profile" className="p-2 rounded-xl hover:bg-navy/5" data-testid="profile-link">
              <User className="w-5 h-5 text-navy" />
            </Link>
            <button onClick={onLogout} className="p-2 rounded-xl hover:bg-navy/5" data-testid="logout-btn">
              <LogOut className="w-5 h-5 text-navy" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        {/* Sidebar */}
        <aside className={`${mobileNav ? "block" : "hidden"} md:block`}>
          <nav className="space-y-1 sticky top-24">
            <span className="label-eyebrow px-3 mb-2 block">{location.pathname.startsWith("/admin") ? "Admin" : "Member"}</span>
            {items.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to} onClick={() => setMobileNav(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${active ? "bg-navy text-white" : "text-navy/80 hover:bg-navy/5"}`}
                  data-testid={`nav-${item.to.replace(/\//g,"-")}`}>
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {(title || actions) && (
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 pb-4 border-b border-navy/10">
              <div>
                {subtitle && <span className="label-eyebrow text-amber-700">{subtitle}</span>}
                {title && <h1 className="font-serif text-3xl sm:text-4xl text-navy mt-1">{title}</h1>}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          )}
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}

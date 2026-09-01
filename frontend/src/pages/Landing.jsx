import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { ArrowRight, MapPin, ShieldCheck, Calendar, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-offwhite">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-offwhite/80 backdrop-blur-xl border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo to="/" size="h-10" />
          <div className="flex items-center gap-2">
            <Link to="/guidelines" className="hidden sm:inline-block text-sm text-navy/70 hover:text-navy mr-3" data-testid="nav-guidelines">Guidelines</Link>
            <Link to="/login" className="btn-outline" data-testid="nav-login">Log In</Link>
            <Link to="/signup" className="btn-accent" data-testid="nav-signup">Sign Up</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-br from-navy/[0.08] via-transparent to-amber-600/[0.06]"
          aria-hidden
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <span className="label-eyebrow text-amber-700">Desai Sethi School of Entrepreneurship</span>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-navy leading-[1.05] tracking-tight mt-4 font-light">
              Co-Working Space.<br />
              <span className="italic font-normal">Built for ventures.</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-2xl">
              A focused workspace on the 4th floor of the DSSE Building — 55 numbered workstations,
              reservable by IDEAS L1, IDEAS L2, Groww and individual student teams. Quiet by design,
              moderated by faculty.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-accent text-base px-8 py-3" data-testid="hero-signup-btn">
                Apply for Access <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login" className="btn-outline text-base px-8 py-3" data-testid="hero-login-btn">
                I have an account
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              <Stat n="55" l="Workstations" />
              <Stat n="9–18" l="Hours / day" />
              <Stat n="20h" l="Per-team / wk" />
            </div>
          </div>
          <div className="lg:col-span-5">
            <FloorPreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <span className="label-eyebrow">How it works</span>
          <h2 className="font-serif text-3xl sm:text-4xl text-navy mt-2 mb-12">Three steps to your seat.</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", t: "Apply or Log In", d: "Sign in with your @iitb.ac.in email (password or a one-time code). Only ideas.iitb@gmail.com has admin access.", icon: ShieldCheck },
              { n: "02", t: "Pick a seat & time", d: "Use the interactive floor map to choose a workstation and your hours within the working window.", icon: MapPin },
              { n: "03", t: "Get approved", d: "Your team's faculty admin reviews and confirms. You'll be notified the moment it's approved.", icon: Calendar },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="dsse-card p-8 dsse-card-hover">
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-serif text-5xl text-navy/15 font-light">{s.n}</span>
                    <Icon className="w-6 h-6 text-amber-600" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif text-xl text-navy mb-2">{s.t}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-12 gap-8">
          <div className="md:col-span-5">
            <span className="label-eyebrow">Who can book</span>
            <h2 className="font-serif text-3xl sm:text-4xl text-navy mt-2 mb-4">Programs we serve.</h2>
            <p className="text-slate-600 leading-relaxed">
              The portal is reserved for active venture teams under DSSE's flagship programs. Each
              team is allocated a weekly quota; bookings are reviewed by program faculty.
            </p>
          </div>
          <div className="md:col-span-7 grid sm:grid-cols-2 gap-4">
            {[
              { t: "IDEAS Level 1", d: "Early-stage student ventures exploring problem-solution fit." },
              { t: "IDEAS Level 2", d: "Validated ventures building MVPs with paying users." },
              { t: "Groww", d: "Growth-stage student ventures scaling to 10x." },
              { t: "Individual Projects", d: "Faculty-sponsored individual student work." },
            ].map((p) => (
              <div key={p.t} className="border-l-2 border-amber pl-5 py-2">
                <Users className="w-4 h-4 text-amber-600 mb-2" />
                <h3 className="font-serif text-lg text-navy">{p.t}</h3>
                <p className="text-sm text-slate-600 mt-1">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy/10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Logo to={null} size="h-9" />
            <p className="text-xs text-slate-500 mt-2">Co-Working Booking Portal · 4th Floor, DSSE Building, IIT Bombay</p>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/guidelines" className="hover:text-navy">Guidelines</Link>
            <Link to="/login" className="hover:text-navy">Log In</Link>
            <Link to="/signup" className="hover:text-navy">Apply</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div>
      <div className="font-serif text-3xl text-navy font-light">{n}</div>
      <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">{l}</div>
    </div>
  );
}

function FloorPreview() {
  // Static decorative preview using same color language
  return (
    <div className="dsse-card p-6">
      <span className="label-eyebrow">Floor preview</span>
      <div className="mt-3 aspect-[10/12] w-full">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <rect x="2" y="2" width="96" height="96" rx="2" fill="#FAFAF7" stroke="#1B2A4E" strokeOpacity="0.15" strokeWidth="0.3" />
          <rect x="6" y="4" width="12" height="6" rx="1" fill="#1B2A4E" fillOpacity="0.08" />
          <text x="12" y="8" fontSize="2.2" textAnchor="middle" fill="#1B2A4E">GATE</text>
          {[12, 27, 42, 57, 72, 87].map((y, i) => (
            <g key={`R-cluster-${y}`}>
              <line x1="60" y1={y} x2="84" y2={y} stroke="#1B2A4E" strokeOpacity="0.2" strokeWidth="0.3" strokeDasharray="0.5 0.4" />
              {[60, 67, 77, 84, 67, 77].map((x, j) => (
                <circle key={`R-${y}-${j}`} cx={x} cy={y + (j < 2 || j === 3 ? 0 : (j < 4 ? -5 : 5))} r="2.2"
                  fill={i === 3 && j === 4 ? "#FEF6E7" : "#fff"} stroke="#1B2A4E" strokeOpacity="0.4" strokeWidth="0.3" />
              ))}
            </g>
          ))}
          {[20, 38, 56, 78].map((y) => (
            <g key={`L-cluster-${y}`}>
              <line x1="40" y1={y} x2="23" y2={y} stroke="#1B2A4E" strokeOpacity="0.2" strokeWidth="0.3" strokeDasharray="0.5 0.4" />
              {[40, 33, 23, 33, 23].map((x, j) => (
                <circle key={`L-${y}-${j}`} cx={x} cy={y + (j === 0 ? 0 : (j < 3 ? -5 : 5))} r="2.2"
                  fill="#fff" stroke="#1B2A4E" strokeOpacity="0.4" strokeWidth="0.3" />
              ))}
            </g>
          ))}
          {/* Pillar between seats 22 & 23 (matches live floor map) */}
          <rect x="74.05" y="56.8" width="2.9" height="5.4" rx="0.35" fill="#1B2A4E" fillOpacity="0.25" />
        </svg>
      </div>
      <p className="text-xs text-slate-500 mt-3 leading-relaxed">
        55 workstations across 10 fishbone clusters. The selected seat is reserved exclusively during your booked window.
      </p>
    </div>
  );
}

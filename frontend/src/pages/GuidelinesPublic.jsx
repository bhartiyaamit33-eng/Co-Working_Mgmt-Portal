import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function GuidelinesPublic() {
  const [g, setG] = useState(null);
  useEffect(() => { api.get("/guidelines/active").then((r) => setG(r.data)).catch(() => {}); }, []);
  return (
    <div className="min-h-screen bg-offwhite">
      <header className="border-b border-navy/10 bg-offwhite/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-navy" data-testid="guidelines-back-home">
            <ArrowLeft className="w-4 h-4" /> <span className="font-serif text-xl">DSSE</span>
          </Link>
          <Link to="/login" className="btn-outline px-4 py-1.5 text-xs">Log in</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <span className="label-eyebrow text-amber-700">Version {g?.version || "—"}</span>
        <h1 className="font-serif text-4xl text-navy mt-2 mb-8">Usage Guidelines</h1>
        {g ? (
          <article className="prose prose-slate max-w-none">
            <Markdown text={g.content_md} />
          </article>
        ) : (
          <div className="text-slate-400">Loading…</div>
        )}
      </main>
    </div>
  );
}

export function Markdown({ text }) {
  // Minimal renderer: headings, bullet lists, paragraphs, bold
  const lines = (text || "").split("\n");
  const out = [];
  let listBuf = [];
  const flush = () => { if (listBuf.length) { out.push(<ul key={out.length} className="list-disc pl-6 my-3 space-y-1">{listBuf.map((x, i) => <li key={i} className="text-slate-700" dangerouslySetInnerHTML={{ __html: bold(x) }} />)}</ul>); listBuf = []; } };
  const bold = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  lines.forEach((raw, i) => {
    const ln = raw;
    if (ln.startsWith("# ")) { flush(); out.push(<h1 key={i} className="font-serif text-3xl text-navy mt-8 mb-3">{ln.slice(2)}</h1>); }
    else if (ln.startsWith("## ")) { flush(); out.push(<h2 key={i} className="font-serif text-2xl text-navy mt-6 mb-2">{ln.slice(3)}</h2>); }
    else if (ln.startsWith("### ")) { flush(); out.push(<h3 key={i} className="font-serif text-lg text-navy mt-4 mb-2">{ln.slice(4)}</h3>); }
    else if (ln.startsWith("- ")) { listBuf.push(ln.slice(2)); }
    else if (ln.trim() === "") { flush(); }
    else { flush(); out.push(<p key={i} className="text-slate-700 leading-relaxed my-2" dangerouslySetInnerHTML={{ __html: bold(ln) }} />); }
  });
  flush();
  return <>{out}</>;
}

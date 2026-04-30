import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { ArrowLeft } from "lucide-react";

export default function GuidelinesPublic() {
  const [g, setG] = useState(null);
  useEffect(() => { api.get("/guidelines/active").then((r) => setG(r.data)).catch(() => {}); }, []);
  return (
    <div className="min-h-screen bg-offwhite">
      <header className="border-b border-navy/10 bg-offwhite/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-navy" data-testid="guidelines-back-home">
            <ArrowLeft className="w-4 h-4" /> <Logo to={null} size="h-9" />
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
  // Safe renderer: headings, bullet lists, paragraphs, **bold** (no dangerouslySetInnerHTML).
  const lines = (text || "").split("\n");
  const blocks = [];
  let listBuf = [];
  const flushList = () => {
    if (listBuf.length) {
      blocks.push({ type: "ul", items: [...listBuf] });
      listBuf = [];
    }
  };
  lines.forEach((ln) => {
    if (ln.startsWith("# ")) { flushList(); blocks.push({ type: "h1", text: ln.slice(2) }); }
    else if (ln.startsWith("## ")) { flushList(); blocks.push({ type: "h2", text: ln.slice(3) }); }
    else if (ln.startsWith("### ")) { flushList(); blocks.push({ type: "h3", text: ln.slice(4) }); }
    else if (ln.startsWith("- ")) { listBuf.push(ln.slice(2)); }
    else if (ln.trim() === "") { flushList(); }
    else { flushList(); blocks.push({ type: "p", text: ln }); }
  });
  flushList();

  // Split a string on **bold** markers and return a React fragment array.
  const renderInline = (str) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) {
        return <strong key={`b-${i}`}>{p.slice(2, -2)}</strong>;
      }
      return <span key={`t-${i}`}>{p}</span>;
    });
  };

  return (
    <>
      {blocks.map((b, i) => {
        const k = `${b.type}-${i}`;
        if (b.type === "h1") return <h1 key={k} className="font-serif text-3xl text-navy mt-8 mb-3">{b.text}</h1>;
        if (b.type === "h2") return <h2 key={k} className="font-serif text-2xl text-navy mt-6 mb-2">{b.text}</h2>;
        if (b.type === "h3") return <h3 key={k} className="font-serif text-lg text-navy mt-4 mb-2">{b.text}</h3>;
        if (b.type === "ul") return (
          <ul key={k} className="list-disc pl-6 my-3 space-y-1">
            {b.items.map((item, j) => <li key={`${k}-${j}-${item.slice(0, 12)}`} className="text-slate-700">{renderInline(item)}</li>)}
          </ul>
        );
        return <p key={k} className="text-slate-700 leading-relaxed my-2">{renderInline(b.text)}</p>;
      })}
    </>
  );
}

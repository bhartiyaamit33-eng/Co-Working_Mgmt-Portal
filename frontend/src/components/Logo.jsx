import { Link } from "react-router-dom";

/** Official DSSE wordmark — preserve PNG colors (white DSS, multicolor E, black plate). */
const LOGO_URL = `${process.env.PUBLIC_URL}/logo.png`;

/**
 * DSSE Logo — Desai Sethi School of Entrepreneurship (public/logo.png).
 * No CSS filters — colors match the asset exactly.
 * variant is kept for API compatibility (default | white | navy); all use the same colors (no filters).
 * size: tailwind h-* class (e.g., "h-8")
 */
export default function Logo({ to = "/", variant = "default", size = "h-8", className = "", showText = false }) {
  const filter = { default: "none", white: "none", navy: "none" }[variant] ?? "none";

  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={LOGO_URL} alt="Desai Sethi School of Entrepreneurship"
        className={`${size} w-auto select-none`} style={{ filter }} draggable="false" data-testid="dsse-logo" />
      {showText && (
        <span className="hidden sm:inline label-eyebrow text-[10px]">Booking Portal</span>
      )}
    </span>
  );

  if (!to) return inner;
  return <Link to={to} className="inline-flex items-center" data-testid="brand-logo">{inner}</Link>;
}

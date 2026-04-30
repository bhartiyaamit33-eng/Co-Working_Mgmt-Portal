import { Link } from "react-router-dom";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_iit-workspace/artifacts/rjs3gpn9_image.png";

/**
 * DSSE Logo — official monochrome mark from Desai Sethi School of Entrepreneurship.
 * Variants:
 *   - "default" : black logo for light backgrounds
 *   - "white"   : inverted (white) for navy backgrounds
 *   - "navy"    : tinted navy for branded backgrounds (uses CSS filter)
 * size: tailwind h-* class (e.g., "h-8")
 */
export default function Logo({ to = "/", variant = "default", size = "h-8", className = "", showText = false }) {
  const filter =
    variant === "white" ? "invert(1) brightness(2)" :
    variant === "navy" ? "brightness(0) saturate(100%) invert(15%) sepia(25%) saturate(1700%) hue-rotate(199deg) brightness(95%) contrast(95%)" :
    "none";

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

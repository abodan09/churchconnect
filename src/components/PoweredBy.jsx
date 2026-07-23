import { Link } from "react-router-dom";

// Site-wide attribution. Rendered in every layout shell and on standalone pages.
// `tone="light"` for dark backgrounds (e.g. the sidebar); default suits light content.
export default function PoweredBy({ className = "", tone = "muted" }) {
  const light = tone === "light";
  return (
    <p className={`text-[11px] ${light ? "text-primary-foreground/50" : "text-muted-foreground/70"} ${className}`}>
      {"Designed & built by "}
      <Link to="/about" className={`font-medium underline-offset-2 hover:underline ${light ? "text-primary-foreground/80" : "text-foreground/80"}`}>
        SoftBit
      </Link>
      {" — a FrozenBit company"}
    </p>
  );
}

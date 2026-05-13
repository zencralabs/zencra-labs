// ─────────────────────────────────────────────────────────────────────────────
// Shimmer — loading skeleton placeholder primitive
// Width and height are controlled entirely by the caller via className.
// ─────────────────────────────────────────────────────────────────────────────

interface ShimmerProps {
  className?: string;
  /** Corner radius class. Default: "rounded-lg" */
  rounded?: string;
}

export default function Shimmer({ className = "", rounded = "rounded-lg" }: ShimmerProps) {
  return (
    <div
      className={`animate-pulse bg-white/[0.06] ${rounded} ${className}`}
    />
  );
}

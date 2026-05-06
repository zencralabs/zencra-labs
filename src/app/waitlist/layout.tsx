/**
 * Waitlist route segment layout.
 *
 * In Next.js App Router nested layouts are COMPOSED inside the root layout,
 * not in place of it. The actual full-screen isolation (no Navbar, no Footer)
 * is handled by pathname guards inside Navbar.tsx and FooterConditional.tsx —
 * both check whether the current path is in the ISOLATED_ROUTES set and bail
 * out before rendering any chrome.
 *
 * This file exists as an explicit signal that /waitlist is an isolated route
 * segment, and provides a hook for any future waitlist-specific wrappers
 * (e.g. analytics, A/B providers) without touching the root layout.
 */
export default function WaitlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

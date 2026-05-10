import { Suspense } from "react";
import LoginPage from "./LoginPage";

/**
 * Thin server-component wrapper required by Next.js App Router.
 * LoginPage uses useSearchParams() which must be wrapped in <Suspense>
 * to avoid the prerender bailout error during static generation.
 */
export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ClientLayout — lifts pricing overlay state above Navbar
// Sits between the Server Root Layout and the Navbar so state can be shared
// without converting layout.tsx to a Client Component.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Navbar } from "./Navbar";
import PricingOverlay from "@/components/pricing/PricingOverlay";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const [pricingOpen, setPricingOpen] = useState(false);

  // Scroll lock — prevent background scroll while overlay is open
  useEffect(() => {
    if (pricingOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [pricingOpen]);

  return (
    <>
      <Navbar onOpenPricing={() => setPricingOpen(true)} />
      {children}
      {pricingOpen && (
        <PricingOverlay onClose={() => setPricingOpen(false)} />
      )}
    </>
  );
}

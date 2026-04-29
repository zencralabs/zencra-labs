"use client";

import { PrivatePreviewGate } from "@/components/preview/PrivatePreviewGate";
import { HomePageContent }    from "@/components/home/HomePageContent";

export default function HomePage() {
  return (
    <PrivatePreviewGate>
      <HomePageContent />
    </PrivatePreviewGate>
  );
}

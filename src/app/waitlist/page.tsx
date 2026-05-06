import type { Metadata } from "next";
import { WaitlistPage } from "@/components/waitlist/WaitlistPage";

export const metadata: Metadata = {
  title:       "Join the Waitlist — Zencra Labs",
  description: "Request early access to Zencra's private creative studio for AI images, videos, voices, and cinematic workflows.",
};

export default function WaitlistRoute() {
  return <WaitlistPage />;
}

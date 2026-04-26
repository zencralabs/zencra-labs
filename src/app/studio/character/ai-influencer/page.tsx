import AIInfluencerBuilder from "@/components/studio/influencer/AIInfluencerBuilder";

export const metadata = {
  title: "AI Influencer Builder",
  description: "Create persistent AI influencers and expand them into production-ready content.",
};

export default function AIInfluencerPage() {
  return (
    // Navbar is h-[76px]. This wrapper fills the remaining viewport height
    // exactly, preventing any overlap with the top nav.
    <div style={{
      height: "calc(100dvh - 76px)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      <AIInfluencerBuilder />
    </div>
  );
}

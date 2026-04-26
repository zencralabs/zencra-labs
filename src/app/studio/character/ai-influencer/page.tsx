import AIInfluencerBuilder from "@/components/studio/influencer/AIInfluencerBuilder";

export const metadata = {
  title: "AI Influencer Builder",
  description: "Create persistent AI influencers and expand them into production-ready content.",
};

export default function AIInfluencerPage() {
  return (
    // Navbar is position:fixed at h-[76px]. marginTop pushes the workspace
    // below the fixed bar; height fills the remaining viewport exactly.
    <div style={{
      marginTop: "76px",
      height: "calc(100dvh - 76px)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      <AIInfluencerBuilder />
    </div>
  );
}

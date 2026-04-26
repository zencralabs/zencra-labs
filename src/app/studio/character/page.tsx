import { redirect } from "next/navigation";

// Character Studio → AI Influencer Builder
// All traffic to /studio/character redirects to the new product route.
export default function CharacterStudioPage() {
  redirect("/studio/character/ai-influencer");
}

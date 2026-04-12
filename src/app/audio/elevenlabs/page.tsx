import { redirect } from "next/navigation";

export default function ElevenLabsPage() {
  redirect("/studio/audio?tool=voiceover");
}

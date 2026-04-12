import { redirect } from "next/navigation";

export default function KitsPage() {
  redirect("/studio/audio?tool=voice-convert");
}

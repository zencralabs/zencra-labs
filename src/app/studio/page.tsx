// /studio → redirect to /studio/image (image generation is the default)
import { redirect } from "next/navigation";

export default function StudioPage() {
  redirect("/studio/image");
}

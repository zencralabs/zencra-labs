import { redirect } from "next/navigation";

// /video/kling → redirect to the real video studio with Kling 3.0 pre-selected
export default function KlingPage() {
  redirect("/studio/video?model=kling-30");
}

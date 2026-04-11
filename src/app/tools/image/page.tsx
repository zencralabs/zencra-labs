/**
 * /tools/image → permanently redirected to /studio/image
 * The Image Studio is now at /studio/image.
 */
import { redirect } from "next/navigation";

export default function ToolsImageRedirect() {
  redirect("/studio/image");
}

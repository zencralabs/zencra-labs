import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";

const DEV_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const IS_DEV = process.env.NODE_ENV === "development";

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);

    if (!authUser && !IS_DEV) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = authUser?.id ?? DEV_DEMO_USER_ID;

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { available: profile.credits },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getMetaDAOHolders } from "@/lib/codex";

export const dynamic = "force-dynamic";
export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
  try {
    const data = await getMetaDAOHolders();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch holder data" },
      { status: 500 }
    );
  }
}

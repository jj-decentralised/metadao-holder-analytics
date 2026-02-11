import { NextResponse } from "next/server";
import { getAllTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * GET /api/tokens
 * Returns the list of all registered tokens
 */
export async function GET() {
  try {
    const tokens = getAllTokens();
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("API Error fetching tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokens" },
      { status: 500 }
    );
  }
}

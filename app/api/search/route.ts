
import { NextRequest, NextResponse } from "next/server";
import { handleError, requireRole, HttpError } from "@/lib/auth";
import { searchSimilar } from "@/lib/embeddings";

// GET /api/search?q=payment+failure
// Performs semantic search using local Ollama embeddings.

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["ADMIN", "ENGINEER"]);

    const searchQuery = req.nextUrl.searchParams.get("q")?.trim();

    if (!searchQuery) {
      throw new HttpError(400, "Search query is required");
    }

    // Generate query embedding and retrieve the top 5 matches.
    const results = await searchSimilar(searchQuery, 5);

    return NextResponse.json({
      query: searchQuery,
      results,
    });
  } catch (error) {
    return handleError(error);
  }
}

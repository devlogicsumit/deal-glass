import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const raw = process.env.NEXCONN_TEST_TOKENS;
    if (!raw) {
      return NextResponse.json(
        { error: "NEXCONN_TEST_TOKENS is not configured" },
        { status: 500 }
      );
    }

    const tokens: Record<string, string> = JSON.parse(raw);
    const token = tokens[userId];

    if (!token) {
      return NextResponse.json(
        { error: `No token found for userId: ${userId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ userId, token });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in NEXCONN_TEST_TOKENS (check .env.local)" },
      { status: 500 }
    );
  }
}
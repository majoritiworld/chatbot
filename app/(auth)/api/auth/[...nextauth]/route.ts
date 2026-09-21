import { NextResponse } from "next/server";

export function GET() {
  return new Response("NextAuth removed. Use /login magic link.", {
    status: 410,
  });
}

export function POST() {
  return NextResponse.json(
    { error: "NextAuth removed. Use Supabase magic link at /login." },
    { status: 410 }
  );
}

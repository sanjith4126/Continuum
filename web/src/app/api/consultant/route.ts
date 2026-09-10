import { NextRequest, NextResponse } from "next/server";
import { askConsultant } from "@/lib/ai/consultant";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const question = (body as { question?: unknown })?.question;
  if (typeof question !== "string") {
    return NextResponse.json({ ok: false, message: "Missing question." }, { status: 400 });
  }

  const result = await askConsultant(question);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

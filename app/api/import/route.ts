import { NextResponse } from "next/server";
import { validateSwimCsv } from "@/lib/csv";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.csv || typeof body.csv !== "string") {
    return NextResponse.json({ error: "Request body must include a csv string." }, { status: 400 });
  }

  return NextResponse.json(validateSwimCsv(body.csv));
}

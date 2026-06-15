import { NextResponse } from "next/server";
import { sampleSwims } from "@/lib/sample-data";

export async function GET() {
  return NextResponse.json({ swims: sampleSwims });
}

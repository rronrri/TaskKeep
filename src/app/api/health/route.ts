import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "taskkeep-empresarial",
    timestamp: new Date().toISOString(),
  });
}

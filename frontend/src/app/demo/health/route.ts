import { NextResponse } from "next/server";

// Demo mode: always healthy
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    agents: {
      company_matcher: true,
      company_researcher: true,
      service_categorizer: true,
      main_agent: true,
    },
  });
}

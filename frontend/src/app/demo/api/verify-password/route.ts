import { NextResponse } from "next/server";

// Demo mode: always accept any password
export async function POST() {
  const token = Date.now().toString(16) + ".demo";
  const response = NextResponse.json({ success: true });
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}

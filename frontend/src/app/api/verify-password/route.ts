import { NextResponse } from "next/server";

const SECRET = () => process.env.APP_PASSWORD ?? "";
const TOKEN_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

/** Derive an HMAC-SHA256 signing key from APP_PASSWORD using Web Crypto. */
async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Create a signed token: `<timestamp_hex>.<signature_hex>` */
async function createToken(): Promise<string> {
  const timestamp = Date.now().toString(16);
  const key = await getKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp),
  );
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${timestamp}.${sigHex}`;
}

/** Timing-safe comparison of two strings using Web Crypto. */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const keyData = enc.encode("comparison-key");
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigA = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(a)),
  );
  const sigB = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(b)),
  );
  if (sigA.length !== sigB.length) return false;
  let result = 0;
  for (let i = 0; i < sigA.length; i++) {
    result |= sigA[i] ^ sigB[i];
  }
  return result === 0;
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const expected = SECRET();
    if (!expected) {
      return NextResponse.json({ success: false, error: "Not configured" }, { status: 500 });
    }

    const match = await timingSafeEqual(password, expected);

    if (!match) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const token = await createToken();
    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.json({ success: true });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

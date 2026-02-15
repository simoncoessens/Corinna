import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_MAX_AGE_MS = 60 * 60 * 24 * 1000; // 24 hours

/** Derive the HMAC-SHA256 key from APP_PASSWORD. */
async function getKey(): Promise<CryptoKey> {
  const secret = process.env.APP_PASSWORD ?? "";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Verify an auth token: `<timestamp_hex>.<signature_hex>` */
async function verifyToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestampHex, sigHex] = parts;

  // Check token age
  const timestamp = parseInt(timestampHex, 16);
  if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_MAX_AGE_MS) {
    return false;
  }

  // Verify HMAC signature
  const key = await getKey();
  const expectedSig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(timestampHex),
    ),
  );

  // Parse hex signature
  const sigBytes = new Uint8Array(sigHex.length / 2);
  for (let i = 0; i < sigBytes.length; i++) {
    sigBytes[i] = parseInt(sigHex.substring(i * 2, i * 2 + 2), 16);
  }

  if (expectedSig.length !== sigBytes.length) return false;

  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    result |= expectedSig[i] ^ sigBytes[i];
  }
  return result === 0;
}

export async function middleware(request: NextRequest) {
  // If APP_PASSWORD is not set, allow all requests (dev convenience)
  if (!process.env.APP_PASSWORD) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;

  if (!token || !(await verifyToken(token))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/assessment/:path*", "/admin/:path*"],
  // Note: /demo paths are NOT listed here, so they pass through without auth.
};

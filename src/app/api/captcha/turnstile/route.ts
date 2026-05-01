import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const body = await req.json().catch(() => ({}));
  const token = body?.token as string | undefined;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing captcha token" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);

  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await r.json().catch(() => ({}));

  if (data?.success) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, error: "Captcha failed" }, { status: 400 });
}


import { checkCredentials, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "");
    password = String(body.password ?? "");
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!checkCredentials(email, password)) {
    return Response.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  await setSessionCookie(email.trim().toLowerCase());
  return Response.json({ ok: true });
}

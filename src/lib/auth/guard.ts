import { getSession } from "./session";

/** For API routes: returns null if authorized, or a 401 Response if not. */
export async function requireAuth(): Promise<Response | null> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const db = getDb();
  const user = db
    .prepare(
      "SELECT id, name, email, password_hash, role, active FROM users WHERE lower(email) = ?"
    )
    .get(String(email).toLowerCase().trim()) as
    | {
        id: number;
        name: string;
        email: string;
        password_hash: string;
        role: "admin" | "cleaner";
        active: number;
      }
    | undefined;

  if (!user || !user.active) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

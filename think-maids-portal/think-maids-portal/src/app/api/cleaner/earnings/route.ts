import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEarningsSummary, getCommissionPercentage } from "@/lib/commission";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const summary = getEarningsSummary(user.id);
  const commissionPercentage = getCommissionPercentage(user.id);
  return NextResponse.json({ ...summary, commissionPercentage });
}

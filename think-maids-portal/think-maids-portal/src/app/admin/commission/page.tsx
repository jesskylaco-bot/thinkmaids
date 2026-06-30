import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";
import CommissionClient from "./CommissionClient";

export default async function AdminCommissionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <AdminShell user={user}>
      <CommissionClient />
    </AdminShell>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";
import CleanersClient from "./CleanersClient";

export default async function AdminCleanersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <AdminShell user={user}>
      <CleanersClient />
    </AdminShell>
  );
}

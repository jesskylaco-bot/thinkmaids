import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";
import ImportClient from "./ImportClient";

export default async function AdminImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <AdminShell user={user}>
      <ImportClient />
    </AdminShell>
  );
}

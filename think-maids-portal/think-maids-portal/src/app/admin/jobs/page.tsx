import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";
import JobsClient from "./JobsClient";

export default async function AdminJobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <AdminShell user={user}>
      <JobsClient />
    </AdminShell>
  );
}

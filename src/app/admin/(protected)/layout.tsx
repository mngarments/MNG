import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import AdminNav from "@/components/admin/AdminNav";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AdminNav email={session} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";
import NavLinks from "./NavLinks";
import type { SessionUser } from "@/lib/types";

export default function AdminShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <p className="font-display text-lg leading-none">Think Maids · Admin</p>
            <p className="text-xs text-muted mt-0.5">{user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 overflow-x-auto">
          <NavLinks
            items={[
              { href: "/admin", label: "Overview" },
              { href: "/admin/import", label: "Import" },
              { href: "/admin/jobs", label: "Jobs" },
              { href: "/admin/cleaners", label: "Cleaners" },
              { href: "/admin/commission", label: "Commission" },
              { href: "/admin/reports", label: "Reports" },
            ]}
          />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  );
}

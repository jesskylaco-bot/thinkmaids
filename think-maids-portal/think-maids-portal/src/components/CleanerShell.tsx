import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";
import NavLinks from "./NavLinks";
import type { SessionUser } from "@/lib/types";

export default function CleanerShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <p className="font-display text-lg leading-none">Think Maids</p>
            <p className="text-xs text-muted mt-0.5">Hi, {user.name.split(" ")[0]}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
        <div className="max-w-2xl mx-auto px-4">
          <NavLinks
            items={[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/schedule", label: "Schedule" },
            ]}
          />
        </div>
      </nav>
    </div>
  );
}

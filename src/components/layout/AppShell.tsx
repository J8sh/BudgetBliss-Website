import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { MobileNav } from "./MobileNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar />
        {/* Bottom padding on phones keeps content clear of the tab bar */}
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24 sm:px-6 sm:pt-6 md:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

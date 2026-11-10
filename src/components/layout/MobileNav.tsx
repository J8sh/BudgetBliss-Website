"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActivePath } from "./navItems";

/**
 * Phone navigation: a bottom tab bar (thumb reach), with Upload in the middle since
 * photographing a receipt is the main thing done on a phone. Everything else is under More.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = NAV_ITEMS.filter((i) => i.mobileTab);
  const more = NAV_ITEMS.filter((i) => !i.mobileTab);
  const moreActive = more.some((i) => isActivePath(pathname, i.href));

  // Dashboard, Insights, [Upload], Receipts, More
  const ordered = [tabs[0]!, tabs[1]!, tabs.find((t) => t.href === "/upload")!, tabs.find((t) => t.href === "/receipts")!];

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {ordered.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            const isUpload = href === "/upload";
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {/* Same-size icon box on every tab keeps the labels on one line */}
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      isUpload && "bg-primary text-primary-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {isUpload ? "Upload" : label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                moreActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center">
                <MoreHorizontal className="h-5 w-5" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1">
            {more.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActivePath(pathname, href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                    isActivePath(pathname, href) ? "bg-muted text-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

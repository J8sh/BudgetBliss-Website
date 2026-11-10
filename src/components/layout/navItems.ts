import {
  ArrowLeftRight,
  History,
  LayoutDashboard,
  Lightbulb,
  Receipt,
  Settings,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar; the rest go under "More" */
  mobileTab?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobileTab: true },
  { href: "/insights", label: "Insights", icon: Lightbulb, mobileTab: true },
  { href: "/receipts", label: "Receipts", icon: Receipt, mobileTab: true },
  { href: "/upload", label: "Upload", icon: Upload, mobileTab: true },
  { href: "/history", label: "History", icon: History },
  { href: "/data", label: "Import & Export", icon: ArrowLeftRight },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

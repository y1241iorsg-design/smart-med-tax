"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Search, BookOpen, Receipt } from "lucide-react";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}[] = [
  { href: "/", label: "ホーム", icon: Home, exact: true },
  { href: "/chat", label: "チャット", icon: MessageCircle },
  { href: "/search", label: "検索", icon: Search },
  { href: "/handbook", label: "手帳", icon: BookOpen },
  { href: "/tax", label: "税制", icon: Receipt },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50"
      style={{ background: "#E3F2FD" }}
    >
      <div className="flex items-center justify-around px-2 py-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                active ? "text-white" : "text-gray-500"
              }`}
              style={active ? { background: "#1565C0" } : undefined}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

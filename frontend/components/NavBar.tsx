"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Search, BookOpen, Receipt } from "lucide-react";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  activeBg: string;
}[] = [
  { href: "/", label: "ホーム", icon: Home, exact: true, activeBg: "#FFCCBC" },
  { href: "/chat", label: "チャット", icon: MessageCircle, activeBg: "#B3E5FC" },
  { href: "/search", label: "検索", icon: Search, activeBg: "#C8E6C9" },
  { href: "/handbook", label: "手帳", icon: BookOpen, activeBg: "#FFF9C4" },
  { href: "/tax", label: "税制", icon: Receipt, activeBg: "#FFE0B2" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 border-t border-gray-100 bg-white"
    >
      <div className="flex items-center justify-around px-2 py-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact, activeBg }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                active ? "text-gray-800" : "text-gray-400"
              }`}
              style={active ? { background: activeBg } : undefined}
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

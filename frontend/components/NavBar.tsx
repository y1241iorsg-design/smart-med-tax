"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/scan", label: "スキャン", icon: "📷" },
  { href: "/chat", label: "相談", icon: "💬" },
  { href: "/history", label: "履歴", icon: "📋" },
  { href: "/tax", label: "税制", icon: "📊" },
] as const;

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="max-w-md mx-auto flex">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-3 text-xs gap-0.5 ${
              pathname === item.href
                ? "text-indigo-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/chat",       label: "相談" },
  { href: "/search",     label: "薬を探す" },
  { href: "/scan",       label: "登録" },
  { href: "/pharmacies", label: "薬局" },
  { href: "/history",    label: "履歴" },
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
            className={`flex-1 flex flex-col items-center py-2.5 text-[10px] gap-0.5 ${
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "text-indigo-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

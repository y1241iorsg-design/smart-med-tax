import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Smart Med-Tax",
  description: "セルフメディケーション税制支援アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background">
        <div className="mx-auto max-w-md min-h-screen flex flex-col bg-white relative sm:shadow-2xl sm:shadow-black/5">
          <main className="flex-1 pb-24">{children}</main>
          <NavBar />
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { NONCE_REQUEST_HEADER } from "@/lib/security-headers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Akatsuki Yui — Team & Project Management System",
    template: "%s | Akatsuki Yui",
  },
  description:
    "Hệ thống quản lý nhóm và dự án nội bộ dành cho sinh viên thực hiện đồ án môn học và đồ án tốt nghiệp.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the per-request nonce opts layout rendering into dynamic SSR so Next.js 16
  // automatically attaches matching nonce attributes to inline hydration/flight scripts.
  await headers().then((hdrs) => hdrs.get(NONCE_REQUEST_HEADER));

  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

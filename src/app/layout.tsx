import type { Metadata } from "next";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { NONCE_REQUEST_HEADER } from "@/lib/security-headers";
import { buildThemeInitScript } from "@/lib/theme";
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
  const nonce = (await headers()).get(NONCE_REQUEST_HEADER) ?? undefined;

  return (
    <html lang="vi" data-mode="light" data-theme="gray" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

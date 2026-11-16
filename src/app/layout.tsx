import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-mode="light" data-theme="gray" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Toaster } from "sonner";
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
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

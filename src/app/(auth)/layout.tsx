import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-foreground hover:text-primary"
        >
          Akatsuki Yui
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          Internal Team &amp; Project Management System
        </p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

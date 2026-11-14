import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-slate-900 hover:text-slate-700"
        >
          Akatsuki Yui
        </Link>
        <p className="mt-1 text-xs text-slate-500">Internal Team &amp; Project Management System</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

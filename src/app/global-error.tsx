"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Hệ thống tạm thời gián đoạn</h1>
          <p className="mt-2 text-sm text-slate-600">
            Đã xảy ra lỗi không mong muốn khi xử lý yêu cầu. Dữ liệu hệ thống vẫn được bảo toàn; vui
            lòng thử tải lại trang.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-slate-500">Mã tham chiếu: {error.digest}</p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={() => reset()}>
              <RotateCcw className="h-4 w-4" />
              <span>Thử lại</span>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Về Dashboard</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Không thể xử lý yêu cầu</CardTitle>
          <CardDescription>
            Đã có sự cố kỹ thuật tạm thời. Vui lòng thử lại hoặc quay về trang chủ Akatsuki Yui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">Mã tham chiếu: {error.digest}</p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={() => reset()}>
              <RotateCcw className="h-4 w-4" />
              <span>Thử lại</span>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Về trang chủ</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Không thể tải nội dung trang</CardTitle>
          <CardDescription>
            Đã xảy ra lỗi khi tải dữ liệu làm việc. Vui lòng thử tải lại hoặc quay về Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">Mã tham chiếu: {error.digest}</p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={() => reset()}>
              <RotateCcw className="h-4 w-4" />
              <span>Thử tải lại</span>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Quay lại Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

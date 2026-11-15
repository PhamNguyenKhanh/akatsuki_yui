import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RootNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <FileQuestion className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">404 — Không tìm thấy trang</CardTitle>
          <CardDescription>
            Đường dẫn hoặc tài nguyên bạn đang tìm không tồn tại hoặc đã bị gỡ bỏ.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard">Về Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Đăng nhập</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

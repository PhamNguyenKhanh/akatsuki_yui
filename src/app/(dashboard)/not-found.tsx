import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <FileQuestion className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">404 — Không tìm thấy tài nguyên</CardTitle>
          <CardDescription>
            Project, Sprint, Task hoặc mục dữ liệu bạn truy cập không tồn tại hoặc không còn hợp lệ.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard">Quay lại Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">Danh sách Project</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

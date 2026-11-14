import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Chờ phê duyệt tài khoản",
};

type PendingApprovalPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function PendingApprovalPage({ searchParams }: PendingApprovalPageProps) {
  const params = await searchParams;

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Clock className="h-6 w-6" />
        </div>
        <CardTitle>Tài khoản đang chờ phê duyệt</CardTitle>
        <CardDescription>
          Yêu cầu đăng ký tài khoản nội bộ của bạn đã được ghi nhận thành công.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-center text-sm text-slate-600">
        {params.email && (
          <p className="rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-900">
            {params.email}
          </p>
        )}
        <p>
          Tài khoản hiện đang ở trạng thái <strong>PENDING</strong>. Vui lòng chờ Quản trị viên
          (Admin) phê duyệt trước khi đăng nhập vào hệ thống.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <Link href="/login">Quay lại trang đăng nhập</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

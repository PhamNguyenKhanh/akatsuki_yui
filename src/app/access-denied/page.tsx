import Link from "next/link";
import { ShieldAlert, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutAction } from "@/modules/auth/auth.actions";

type AccessDeniedPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
  const params = await searchParams;
  const isInactive = params.reason === "inactive";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle>
            {isInactive ? "Tài khoản không còn hoạt động" : "Không có quyền truy cập"}
          </CardTitle>
          <CardDescription>
            {isInactive
              ? "Tài khoản của bạn hiện không ở trạng thái ACTIVE (có thể đã bị tạm khóa hoặc thay đổi trạng thái). Vui lòng liên hệ Quản trị viên."
              : "Tài khoản hiện tại không có Permission để truy cập chức năng hoặc trang này."}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center text-xs text-muted-foreground">
          Nếu bạn vừa được cập nhật quyền hạn, hãy thử đăng xuất và đăng nhập lại.
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {!isInactive && (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Về Dashboard
              </Link>
            </Button>
          )}
          <form action={logoutAction} className="w-full sm:w-auto">
            <Button type="submit" variant={isInactive ? "default" : "secondary"} className="w-full">
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Users, KeyRound } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOptionalAuthContext } from "@/modules/authorization/require-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authContext = await getOptionalAuthContext();
  if (authContext) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-3xl space-y-8">
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-xs">
            Internal Workspace · Akatsuki Yui
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Team &amp; Project Management System
          </h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
            Không gian làm việc nội bộ giúp quản lý thành viên, phân quyền theo vai trò và theo dõi
            tiến độ đồ án của nhóm.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/login">Đăng nhập</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/register">Đăng ký thành viên</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <ShieldCheck className="mb-1 h-5 w-5 text-primary" />
              <CardTitle className="text-base">Phê duyệt tài khoản</CardTitle>
              <CardDescription>
                Tài khoản mới đăng ký sẽ ở trạng thái PENDING cho tới khi Admin phê duyệt.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <KeyRound className="mb-1 h-5 w-5 text-primary" />
              <CardTitle className="text-base">Kiểm soát truy cập RBAC</CardTitle>
              <CardDescription>
                Phân quyền chi tiết phía Server cho Admin, Instructor, Leader và Member.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="mb-1 h-5 w-5 text-primary" />
              <CardTitle className="text-base">Quản lý hồ sơ</CardTitle>
              <CardDescription>
                Thành viên chủ động cập nhật thông tin cá nhân và bảo mật mật khẩu.
              </CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        </div>
      </div>
    </main>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/modules/auth/auth.actions";
import { loginSchema, type LoginInput } from "@/modules/auth/auth.schema";

function getSafeCallbackUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.startsWith("/") || rawUrl.startsWith("//")) {
    return "/dashboard";
  }
  return rawUrl;
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<{
    code: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result = await loginAction(values);

    if (!result.ok) {
      setServerError({
        code: result.error.code,
        message: result.error.message,
      });
      return;
    }

    toast.success("Đăng nhập thành công.");
    const destination = getSafeCallbackUrl(callbackUrl);
    router.push(destination);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng nhập</CardTitle>
        <CardDescription>
          Sử dụng tài khoản nội bộ Akatsuki Yui để truy cập workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <Alert variant={serverError.code === "ACCOUNT_PENDING" ? "warning" : "destructive"}>
              <AlertTitle>
                {serverError.code === "ACCOUNT_PENDING"
                  ? "Tài khoản đang chờ phê duyệt"
                  : serverError.code === "ACCOUNT_SUSPENDED"
                    ? "Tài khoản bị tạm khóa"
                    : serverError.code === "ACCOUNT_REJECTED"
                      ? "Tài khoản đã bị từ chối"
                      : "Đăng nhập thất bại"}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{serverError.message}</p>
                {serverError.code === "ACCOUNT_PENDING" && (
                  <Link
                    href="/pending-approval"
                    className="inline-block font-medium underline underline-offset-4"
                  >
                    Xem hướng dẫn chờ phê duyệt
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Đăng nhập
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-border pt-4 text-sm text-muted-foreground">
        <span>Chưa có tài khoản?</span>
        <Link
          href="/register"
          className="ml-1.5 font-medium text-foreground underline underline-offset-4 hover:text-slate-700"
        >
          Đăng ký ngay
        </Link>
      </CardFooter>
    </Card>
  );
}

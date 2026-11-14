"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Circle } from "lucide-react";
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
import { registerAction } from "@/modules/auth/auth.actions";
import { registerSchema, type RegisterInput } from "@/modules/auth/auth.schema";

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [passwordValue, setPasswordValue] = React.useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const passwordChecks = [
    { label: "Ít nhất 8 ký tự", met: passwordValue.length >= 8 },
    { label: "Có ít nhất 1 chữ hoa (A-Z)", met: /[A-Z]/.test(passwordValue) },
    { label: "Có ít nhất 1 chữ thường (a-z)", met: /[a-z]/.test(passwordValue) },
    { label: "Có ít nhất 1 chữ số (0-9)", met: /\d/.test(passwordValue) },
    { label: "Có ít nhất 1 ký tự đặc biệt", met: /[^A-Za-z0-9]/.test(passwordValue) },
  ];

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    const result = await registerAction(values);

    if (!result.ok) {
      if (result.error.code === "EMAIL_ALREADY_EXISTS") {
        setError("email", { message: result.error.message });
      }
      setServerError(result.error.message);
      return;
    }

    toast.success("Đăng ký thành công. Tài khoản đang chờ phê duyệt.");
    router.push(`/pending-approval?email=${encodeURIComponent(result.data.email)}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng ký tài khoản</CardTitle>
        <CardDescription>
          Tài khoản mới sẽ được đặt ở trạng thái PENDING cho tới khi Quản trị viên phê duyệt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <Alert variant="destructive">
              <AlertTitle>Không thể hoàn tất đăng ký</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fullName">Họ và tên</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              aria-invalid={Boolean(errors.fullName)}
              {...register("fullName")}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="member@example.com"
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
              autoComplete="new-password"
              placeholder="Nhập mật khẩu mạnh"
              aria-invalid={Boolean(errors.password)}
              {...register("password", {
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  setPasswordValue(event.target.value),
              })}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
            <ul className="mt-2 space-y-1 rounded-md bg-slate-50 p-2.5 text-xs text-slate-600">
              {passwordChecks.map((rule) => (
                <li key={rule.label} className="flex items-center gap-1.5">
                  {rule.met ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className={rule.met ? "text-emerald-700" : undefined}>{rule.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Tạo tài khoản
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-border pt-4 text-sm text-muted-foreground">
        <span>Đã có tài khoản?</span>
        <Link
          href="/login"
          className="ml-1.5 font-medium text-foreground underline underline-offset-4 hover:text-slate-700"
        >
          Đăng nhập
        </Link>
      </CardFooter>
    </Card>
  );
}

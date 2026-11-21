"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
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
import { requestPasswordResetAction } from "@/modules/auth/password-reset.actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const result = await requestPasswordResetAction(email);
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setSent(true);
  }

  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Quên mật khẩu</CardTitle>
        <CardDescription>
          Nhập email tài khoản đang hoạt động để nhận liên kết đặt lại mật khẩu (hiệu lực 30 phút).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle>Đã gửi yêu cầu đặt lại mật khẩu</AlertTitle>
            <AlertDescription>
              Nếu email <strong>{email}</strong> tồn tại và đang hoạt động trên hệ thống, bạn sẽ
              nhận được email hướng dẫn trong ít phút. Hãy kiểm tra cả hộp thư Spam.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Không thể gửi yêu cầu</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={submitting}
              />
            </div>

            <Button type="submit" className="w-full" isLoading={submitting}>
              <Mail className="h-4 w-4" />
              <span>Gửi liên kết đặt lại mật khẩu</span>
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t border-border pt-4 text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4 hover:text-slate-700"
        >
          Quay lại đăng nhập
        </Link>
      </CardFooter>
    </Card>
  );
}

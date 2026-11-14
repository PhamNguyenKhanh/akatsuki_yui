"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AccountStatusBadge, RoleBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPasswordAction, updateMyProfileAction } from "@/modules/users/user.actions";
import {
  changePasswordSchema,
  type ChangePasswordInput,
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/modules/users/user.schema";
import type { SafeUserDTO } from "@/types/auth";

export function ProfileForms({ initialProfile }: { initialProfile: SafeUserDTO }) {
  const router = useRouter();
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: initialProfile.fullName,
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onUpdateProfile(values: UpdateProfileInput) {
    setProfileError(null);
    const result = await updateMyProfileAction(values);
    if (!result.ok) {
      setProfileError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("Cập nhật hồ sơ cá nhân thành công.");
    profileForm.reset({ fullName: result.data.fullName });
    router.refresh();
  }

  async function onChangePassword(values: ChangePasswordInput) {
    setPasswordError(null);
    const result = await changeMyPasswordAction(values);
    if (!result.ok) {
      const currentPwdDetail = result.error.details?.find(
        (detail) => detail.field === "currentPassword"
      );
      if (currentPwdDetail) {
        passwordForm.setError("currentPassword", { message: currentPwdDetail.message });
      }
      setPasswordError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("Đổi mật khẩu thành công.");
    passwordForm.reset();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin cá nhân</CardTitle>
          <CardDescription>
            Theo quy định hệ thống, bạn chỉ có thể cập nhật Họ và tên. Email và Role do Quản trị
            viên quản lý.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit(onUpdateProfile)}
            className="space-y-4"
            noValidate
          >
            {profileError && (
              <Alert variant="destructive">
                <AlertTitle>Không thể cập nhật</AlertTitle>
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={initialProfile.email}
                disabled
                readOnly
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Trạng thái tài khoản</Label>
                <div>
                  <AccountStatusBadge status={initialProfile.status} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Vai trò (Role)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {initialProfile.roles.map((role) => (
                    <RoleBadge key={role} role={role} />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-fullName">Họ và tên</Label>
              <Input
                id="profile-fullName"
                type="text"
                aria-invalid={Boolean(profileForm.formState.errors.fullName)}
                {...profileForm.register("fullName")}
              />
              {profileForm.formState.errors.fullName && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.fullName.message}
                </p>
              )}
            </div>

            <Button type="submit" isLoading={profileForm.formState.isSubmitting}>
              Lưu thay đổi
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
          <CardDescription>
            Mật khẩu mới tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit(onChangePassword)}
            className="space-y-4"
            noValidate
          >
            {passwordError && (
              <Alert variant="destructive">
                <AlertTitle>Không thể đổi mật khẩu</AlertTitle>
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(passwordForm.formState.errors.currentPassword)}
                {...passwordForm.register("currentPassword")}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordForm.formState.errors.newPassword)}
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordForm.formState.errors.confirmNewPassword)}
                {...passwordForm.register("confirmNewPassword")}
              />
              {passwordForm.formState.errors.confirmNewPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirmNewPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" isLoading={passwordForm.formState.isSubmitting}>
              Cập nhật mật khẩu
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

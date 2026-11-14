import type { Metadata } from "next";
import { ProfileForms } from "@/components/users/profile-forms";
import { requireActiveUserOrRedirect } from "@/modules/authorization/require-auth";
import { getMyProfileService } from "@/modules/users/user.service";

export const metadata: Metadata = {
  title: "Hồ sơ cá nhân",
};

export default async function ProfilePage() {
  const actor = await requireActiveUserOrRedirect();
  const profile = await getMyProfileService(actor);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hồ sơ cá nhân</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Xem thông tin tài khoản, cập nhật họ tên và thay đổi mật khẩu đăng nhập.
        </p>
      </div>

      <ProfileForms initialProfile={profile} />
    </div>
  );
}

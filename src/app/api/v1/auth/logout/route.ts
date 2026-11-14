import { auth, signOut } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { recordLogoutActivity } from "@/modules/auth/auth.service";

export async function POST() {
  try {
    const session = await auth();
    if (session?.user?.id) {
      await recordLogoutActivity(session.user.id, session.user.email).catch(() => undefined);
    }
    await signOut({ redirect: false });
    return apiSuccess({ loggedOut: true });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/auth/logout" });
  }
}

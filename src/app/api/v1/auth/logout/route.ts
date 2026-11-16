import { auth, signOut } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { revokeUserSessionOnLogout } from "@/modules/auth/auth.service";

export async function POST() {
  try {
    const session = await auth();
    if (session?.user?.id) {
      await revokeUserSessionOnLogout({
        userId: session.user.id,
        email: session.user.email,
        expectedTokenVersion:
          typeof session.user.tokenVersion === "number" && session.user.tokenVersion >= 0
            ? session.user.tokenVersion
            : undefined,
      });
    }
    await signOut({ redirect: false });
    return apiSuccess({ loggedOut: true });
  } catch (error) {
    return apiError(error, { route: "POST /api/v1/auth/logout" });
  }
}

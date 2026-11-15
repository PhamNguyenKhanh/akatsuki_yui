import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { runSafeSeed } from "./seed-helpers";

const prisma = new PrismaClient();

async function main() {
  const result = await runSafeSeed(prisma, process.env);

  console.log(
    `[prisma:seed] Synchronized ${result.permissionCount} permissions across roles (${result.createdRoles.length} new role(s) bootstrapped with ${result.grantedDefaultPermissionCount} default permission(s)).`
  );

  if (result.adminResult.created) {
    console.log("[prisma:seed] Created initial ACTIVE admin account from SEED_ADMIN_* env.");
  } else if (result.adminResult.skippedExisting) {
    console.log(
      "[prisma:seed] Admin account already exists; existing profile/password/status preserved (DEC-067)."
    );
  } else {
    console.log(
      "[prisma:seed] Skipped admin bootstrap (set SEED_ADMIN_EMAIL and strong SEED_ADMIN_PASSWORD to create initial admin)."
    );
  }
}

main()
  .catch((error) => {
    console.error(
      "[prisma:seed] Failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

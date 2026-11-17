import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActivityLogClient } from "@/components/activity/activity-log-client";
import { isAppError } from "@/lib/errors";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import {
  getActivityFilterOptionsService,
  listUnifiedActivityService,
} from "@/modules/activity/activity.service";

export const metadata: Metadata = {
  title: "Lịch sử Hoạt động | Akatsuki Yui",
};

interface ActivityPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.ACTIVITY_READ);
  const resolved = await searchParams;
  const initialProjectId =
    typeof resolved.projectId === "string" && resolved.projectId.trim().length > 0
      ? resolved.projectId.trim()
      : undefined;

  let initialFeed;
  let filterOptions;
  try {
    [initialFeed, filterOptions] = await Promise.all([
      listUnifiedActivityService(actor, {
        ...(initialProjectId ? { projectId: initialProjectId } : {}),
        limit: 10,
      }),
      getActivityFilterOptionsService(actor),
    ]);
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "FORBIDDEN") redirect("/access-denied?reason=forbidden");
      if (error.code === "NOT_FOUND" || error.code === "VALIDATION_ERROR") notFound();
    }
    throw error;
  }

  return (
    <ActivityLogClient
      initialFeed={initialFeed}
      filterOptions={filterOptions}
      initialProjectId={initialProjectId}
    />
  );
}

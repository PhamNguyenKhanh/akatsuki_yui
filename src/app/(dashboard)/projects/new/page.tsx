import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectForm } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { requirePermissionOrRedirect } from "@/modules/authorization/require-auth";
import { projectTemplateRepository } from "@/modules/project-templates/template.repository";
import { listProjectUserCandidatesService } from "@/modules/projects/project.service";

export const metadata: Metadata = {
  title: "Tạo Project mới",
};

export default async function NewProjectPage() {
  const actor = await requirePermissionOrRedirect(PERMISSIONS.PROJECT_CREATE);
  const isAdmin = actor.roles.includes(ROLES.ADMIN);

  const [templates, instructorOptions, leaderOptions, memberOptions] = await Promise.all([
    projectTemplateRepository.findActiveOptions(),
    listProjectUserCandidatesService(actor, { kind: "instructor" }),
    isAdmin ? listProjectUserCandidatesService(actor, { kind: "leader" }) : Promise.resolve([]),
    listProjectUserCandidatesService(actor, { kind: "member" }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tạo Project mới</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Khởi tạo Project mới cho môn học hoặc đồ án tốt nghiệp.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh sách</span>
          </Link>
        </Button>
      </div>

      <ProjectForm
        mode="create"
        templates={templates}
        instructorOptions={instructorOptions}
        leaderOptions={leaderOptions}
        memberOptions={memberOptions}
        currentUserId={actor.userId}
        currentUserName={actor.fullName}
        isAdminCreator={isAdmin}
      />
    </div>
  );
}

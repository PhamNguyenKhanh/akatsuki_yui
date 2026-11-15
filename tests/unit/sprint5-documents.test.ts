import { DocumentCategory, ProjectMemberRole, ProjectStatus, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import { canActorManageProjectDocuments } from "@/modules/documents/document.access";
import {
  createDocumentSchema,
  validateGoogleDriveUrl,
} from "@/modules/documents/document.validation";
import type { AuthContext } from "@/types/auth";

const { prismaMock } = vi.hoisted(() => {
  const mock: Record<string, unknown> = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
    },
    document: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  };
  mock.$transaction = vi.fn(async (cb: (tx: typeof mock) => unknown) => cb(mock));
  return { prismaMock: mock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  createDocumentService,
  deleteDocumentService,
  updateDocumentService,
} from "@/modules/documents/document.service";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const LEADER_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";
const INSTRUCTOR_ID = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_PROJECT_ID = "66666666-6666-4666-8666-666666666666";
const SPRINT_ID = "77777777-7777-4777-8777-777777777777";
const DOC_ID = "88888888-8888-4888-8888-888888888888";

const adminActor: AuthContext = {
  userId: ADMIN_ID,
  email: "admin@akatsuki.local",
  fullName: "Admin User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.ADMIN],
  permissions: Object.values(PERMISSIONS),
};

const leaderActor: AuthContext = {
  userId: LEADER_ID,
  email: "leader@akatsuki.local",
  fullName: "Leader User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_MANAGE],
};

const defaultMemberActor: AuthContext = {
  userId: MEMBER_ID,
  email: "member@akatsuki.local",
  fullName: "Member User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.MEMBER],
  permissions: [PERMISSIONS.DOCUMENT_READ],
};

const grantedMemberActor: AuthContext = {
  ...defaultMemberActor,
  permissions: [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_MANAGE],
};

const instructorActor: AuthContext = {
  userId: INSTRUCTOR_ID,
  email: "instructor@akatsuki.local",
  fullName: "Instructor User",
  status: UserStatus.ACTIVE,
  roles: [ROLES.INSTRUCTOR],
  permissions: [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.DOCUMENT_MANAGE],
};

describe("Sprint 5 — Document Library Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Google Drive & Google Docs URL Validation (DEC-035)", () => {
    it("accepts valid HTTPS links on drive.google.com and docs.google.com", () => {
      const validUrls = [
        "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing",
        "https://drive.google.com/drive/folders/1a2b3c4d5e",
        "https://docs.google.com/document/d/1234567890/edit",
        "https://docs.google.com/spreadsheets/d/abcdef/edit#gid=0",
        "https://docs.google.com/presentation/d/xyz/edit",
      ];

      for (const url of validUrls) {
        const res = validateGoogleDriveUrl(url);
        expect(res.valid).toBe(true);
        const parsed = createDocumentSchema.safeParse({
          title: "SRS v1.0",
          url,
          category: DocumentCategory.SPECIFICATION,
        });
        expect(parsed.success).toBe(true);
      }
    });

    it("rejects non-HTTPS, lookalike domains, subdomains, credentials, OneDrive/Dropbox, and bare root URLs", () => {
      const invalidUrls = [
        "http://drive.google.com/file/d/123/view",
        "https://evil-drive.google.com/file/d/123",
        "https://drive.google.com.attacker.org/file/d/123",
        "https://sub.drive.google.com/file/d/123",
        "https://user:pass@drive.google.com/file/d/123",
        "https://onedrive.live.com/view.aspx?resid=123",
        "https://www.dropbox.com/s/123/spec.pdf",
        "https://drive.google.com/",
        "https://docs.google.com",
        "javascript:alert(1)",
      ];

      for (const url of invalidUrls) {
        const res = validateGoogleDriveUrl(url);
        expect(res.valid).toBe(false);
      }
    });
  });

  describe("Document RBAC & Permission Matrix Scoping (DEC-034)", () => {
    it("enforces ADMIN, LEADER, default MEMBER, granted MEMBER, INSTRUCTOR, and ARCHIVED rules", () => {
      const activeProject = {
        leaderId: LEADER_ID,
        status: ProjectStatus.ACTIVE,
        members: [{ projectRole: ProjectMemberRole.MEMBER }],
      };

      expect(canActorManageProjectDocuments(adminActor, activeProject)).toBe(true);
      expect(canActorManageProjectDocuments(leaderActor, activeProject)).toBe(true);
      expect(canActorManageProjectDocuments(defaultMemberActor, activeProject)).toBe(false);
      expect(canActorManageProjectDocuments(grantedMemberActor, activeProject)).toBe(true);

      const instructorProject = {
        leaderId: LEADER_ID,
        status: ProjectStatus.ACTIVE,
        members: [{ projectRole: ProjectMemberRole.INSTRUCTOR }],
      };
      expect(canActorManageProjectDocuments(instructorActor, instructorProject)).toBe(false);

      const archivedProject = {
        ...activeProject,
        status: ProjectStatus.ARCHIVED,
      };
      expect(canActorManageProjectDocuments(adminActor, archivedProject)).toBe(false);
      expect(canActorManageProjectDocuments(leaderActor, archivedProject)).toBe(false);
    });
  });

  describe("Document Service Mutations, Sprint Integrity & Soft Delete (DEC-036)", () => {
    it("blocks creating, updating, or deleting Documents when Project is ARCHIVED", async () => {
      (prismaMock.project as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
        {
          id: PROJECT_ID,
          name: "Archived Project",
          status: ProjectStatus.ARCHIVED,
          leaderId: LEADER_ID,
          instructorId: null,
          members: [{ id: "m-1", projectRole: ProjectMemberRole.LEADER }],
        }
      );

      await expect(
        createDocumentService(leaderActor, PROJECT_ID, {
          title: "Architecture Spec",
          url: "https://docs.google.com/document/d/abc/edit",
          category: DocumentCategory.SPECIFICATION,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "PROJECT_ARCHIVED",
      });
    });

    it("rejects linking a Sprint from a different Project (409 CROSS_PROJECT_SPRINT_MISMATCH)", async () => {
      (prismaMock.project as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
        {
          id: PROJECT_ID,
          name: "Active Project",
          status: ProjectStatus.ACTIVE,
          leaderId: LEADER_ID,
          instructorId: null,
          members: [{ id: "m-1", projectRole: ProjectMemberRole.LEADER }],
        }
      );
      (prismaMock.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: PROJECT_ID, status: ProjectStatus.ACTIVE },
      ]);
      (prismaMock.sprint as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({
        id: SPRINT_ID,
        projectId: OTHER_PROJECT_ID,
        name: "Other Project Sprint",
      });

      await expect(
        createDocumentService(leaderActor, PROJECT_ID, {
          title: "Sprint Report",
          url: "https://docs.google.com/document/d/abc/edit",
          category: DocumentCategory.REPORT,
          sprintId: SPRINT_ID,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "CROSS_PROJECT_SPRINT_MISMATCH",
      });
    });

    it("soft-deletes Document by setting deletedAt and recording AuditLog & ActivityLog", async () => {
      (prismaMock.document as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue({
        id: DOC_ID,
        projectId: PROJECT_ID,
        sprintId: null,
        uploadedById: LEADER_ID,
        title: "UI Wireframe Link",
        url: "https://drive.google.com/file/d/xyz/view",
        category: DocumentCategory.DESIGN,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      (prismaMock.project as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
        {
          id: PROJECT_ID,
          name: "Active Project",
          status: ProjectStatus.ACTIVE,
          leaderId: LEADER_ID,
          instructorId: null,
          members: [{ id: "m-1", projectRole: ProjectMemberRole.LEADER }],
        }
      );
      (prismaMock.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: PROJECT_ID, status: ProjectStatus.ACTIVE },
      ]);
      (prismaMock.document as { update: ReturnType<typeof vi.fn> }).update.mockResolvedValue({
        id: DOC_ID,
      });

      const deleted = await deleteDocumentService(leaderActor, DOC_ID);

      expect(deleted.id).toBe(DOC_ID);
      expect(deleted.deletedAt).toEqual(expect.any(String));
      expect(
        (prismaMock.document as { update: ReturnType<typeof vi.fn> }).update
      ).toHaveBeenCalledWith({
        where: { id: DOC_ID },
        data: { deletedAt: expect.any(Date) },
      });
      expect(
        (prismaMock.auditLog as { create: ReturnType<typeof vi.fn> }).create
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "DOCUMENT_SOFT_DELETED",
            entityId: DOC_ID,
          }),
        })
      );
      expect(
        (prismaMock.activityLog as { create: ReturnType<typeof vi.fn> }).create
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "DOCUMENT_SOFT_DELETED",
            entityId: DOC_ID,
          }),
        })
      );
    });

    it("rejects updateDocumentService when no fields are provided", async () => {
      await expect(updateDocumentService(leaderActor, DOC_ID, {})).rejects.toBeInstanceOf(AppError);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserStatus } from "@prisma/client";
import { forbiddenError, unauthorizedError } from "@/lib/errors";
import { PERMISSIONS, ROLES } from "@/modules/authorization/constants";
import type { AuthContext } from "@/types/auth";

vi.mock("server-only", () => ({}));

const {
  requireActiveUserMock,
  listUnifiedActivityServiceMock,
  getOperationalDashboardServiceMock,
  getProjectAnalyticsServiceMock,
  getMemberContributionReportServiceMock,
  getProjectSprintReportServiceMock,
} = vi.hoisted(() => ({
  requireActiveUserMock: vi.fn(),
  listUnifiedActivityServiceMock: vi.fn(),
  getOperationalDashboardServiceMock: vi.fn(),
  getProjectAnalyticsServiceMock: vi.fn(),
  getMemberContributionReportServiceMock: vi.fn(),
  getProjectSprintReportServiceMock: vi.fn(),
}));

vi.mock("@/modules/authorization/require-auth", () => ({
  requireActiveUser: requireActiveUserMock,
}));
vi.mock("@/modules/activity/activity.service", () => ({
  listUnifiedActivityService: listUnifiedActivityServiceMock,
}));
vi.mock("@/modules/dashboard/dashboard.service", () => ({
  getOperationalDashboardService: getOperationalDashboardServiceMock,
}));
vi.mock("@/modules/reports/project-analytics.service", () => ({
  getProjectAnalyticsService: getProjectAnalyticsServiceMock,
}));
vi.mock("@/modules/reports/member-contribution.service", () => ({
  getMemberContributionReportService: getMemberContributionReportServiceMock,
}));
vi.mock("@/modules/reports/sprint-report.service", () => ({
  getProjectSprintReportService: getProjectSprintReportServiceMock,
}));

import { GET as activityGet } from "@/app/api/v1/activity/route";
import { GET as dashboardGet } from "@/app/api/v1/dashboard/route";
import { GET as projectAnalyticsGet } from "@/app/api/v1/reports/projects/[projectId]/route";
import { GET as memberContributionGet } from "@/app/api/v1/reports/projects/[projectId]/members/route";
import { GET as sprintReportGet } from "@/app/api/v1/reports/projects/[projectId]/sprints/route";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const activeActor: AuthContext = {
  userId: "22222222-2222-4222-8222-222222222201",
  email: "leader@akatsuki.local",
  fullName: "Leader",
  status: UserStatus.ACTIVE,
  roles: [ROLES.LEADER],
  permissions: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.ACTIVITY_READ,
  ],
};

describe("Sprint 6 Package 6 — View-Only API Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveUserMock.mockResolvedValue(activeActor);
  });

  it("enforces authentication (401) across Sprint 6 endpoints", async () => {
    requireActiveUserMock.mockRejectedValue(unauthorizedError());

    const resDash = await dashboardGet(new NextRequest("http://localhost/api/v1/dashboard"));
    const resAct = await activityGet(new NextRequest("http://localhost/api/v1/activity"));
    const resRep = await projectAnalyticsGet(
      new NextRequest(`http://localhost/api/v1/reports/projects/${PROJECT_ID}`),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );

    expect(resDash.status).toBe(401);
    expect(resAct.status).toBe(401);
    expect(resRep.status).toBe(401);
  });

  it("passes query parameters cleanly and returns 200 JSON responses for all 5 endpoints", async () => {
    getOperationalDashboardServiceMock.mockResolvedValue({ selectedProject: { id: PROJECT_ID } });
    const dashRes = await dashboardGet(
      new NextRequest(`http://localhost/api/v1/dashboard?projectId=${PROJECT_ID}`)
    );
    expect(dashRes.status).toBe(200);
    expect(getOperationalDashboardServiceMock).toHaveBeenCalledWith(activeActor, {
      projectId: PROJECT_ID,
    });

    listUnifiedActivityServiceMock.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, limit: 20 },
    });
    const actRes = await activityGet(
      new NextRequest(
        `http://localhost/api/v1/activity?projectId=${PROJECT_ID}&source=TASK&limit=10`
      )
    );
    expect(actRes.status).toBe(200);
    expect(listUnifiedActivityServiceMock).toHaveBeenCalledWith(activeActor, {
      projectId: PROJECT_ID,
      source: "TASK",
      limit: "10",
    });

    getProjectAnalyticsServiceMock.mockResolvedValue({ projectId: PROJECT_ID });
    const analyticsRes = await projectAnalyticsGet(
      new NextRequest(`http://localhost/api/v1/reports/projects/${PROJECT_ID}?preset=90d`),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(analyticsRes.status).toBe(200);
    expect(getProjectAnalyticsServiceMock).toHaveBeenCalledWith(activeActor, PROJECT_ID, {
      preset: "90d",
    });

    getMemberContributionReportServiceMock.mockResolvedValue({
      projectId: PROJECT_ID,
      members: [],
    });
    const membersRes = await memberContributionGet(
      new NextRequest(
        `http://localhost/api/v1/reports/projects/${PROJECT_ID}/members?includeRemoved=false`
      ),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(membersRes.status).toBe(200);
    expect(getMemberContributionReportServiceMock).toHaveBeenCalledWith(activeActor, PROJECT_ID, {
      includeRemoved: "false",
    });

    getProjectSprintReportServiceMock.mockResolvedValue({ projectId: PROJECT_ID, sprints: [] });
    const sprintsRes = await sprintReportGet(
      new NextRequest(`http://localhost/api/v1/reports/projects/${PROJECT_ID}/sprints`),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(sprintsRes.status).toBe(200);
    expect(getProjectSprintReportServiceMock).toHaveBeenCalledWith(activeActor, PROJECT_ID);
  });

  it("maps RBAC forbidden errors cleanly to 403", async () => {
    getProjectAnalyticsServiceMock.mockRejectedValue(forbiddenError());
    const res = await projectAnalyticsGet(
      new NextRequest(`http://localhost/api/v1/reports/projects/${PROJECT_ID}`),
      { params: Promise.resolve({ projectId: PROJECT_ID }) }
    );
    expect(res.status).toBe(403);
  });
});

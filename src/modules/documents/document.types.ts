import type { DocumentCategory, ProjectStatus, SprintStatus } from "@prisma/client";

export interface DocumentUploaderDTO {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface DocumentProjectSummaryDTO {
  id: string;
  name: string;
  status: ProjectStatus;
  leaderId: string;
}

export interface DocumentSprintSummaryDTO {
  id: string;
  name: string;
  status: SprintStatus;
}

export interface DocumentDTO {
  id: string;
  projectId: string;
  sprintId: string | null;
  uploadedById: string;
  title: string;
  url: string | null;
  category: DocumentCategory;
  description: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  project: DocumentProjectSummaryDTO;
  sprint: DocumentSprintSummaryDTO | null;
  uploadedBy: DocumentUploaderDTO;
}

export interface DocumentListResponseDTO {
  items: DocumentDTO[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AccessibleProjectOptionDTO {
  id: string;
  name: string;
  status: ProjectStatus;
  canManageDocuments: boolean;
  sprints: DocumentSprintSummaryDTO[];
}

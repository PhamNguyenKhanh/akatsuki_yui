"use client";

import * as React from "react";
import type { ProjectCandidateUserDTO } from "@/modules/projects/project.repository";
import type { ProjectCandidateKind } from "@/modules/projects/project.schema";

export function useProjectCandidateSearch(options: {
  initialItems: ProjectCandidateUserDTO[];
  kind: ProjectCandidateKind;
  projectId?: string;
  excludeCurrentMembers?: boolean;
  enabled?: boolean;
}) {
  const { initialItems, kind, projectId, excludeCurrentMembers = false, enabled = true } = options;
  const [query, setQuery] = React.useState("");
  const [remoteResult, setRemoteResult] = React.useState<{
    query: string;
    items: ProjectCandidateUserDTO[];
  } | null>(null);
  const [searching, setSearching] = React.useState(false);

  const trimmedQuery = query.trim();

  React.useEffect(() => {
    if (!enabled || !trimmedQuery) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          kind,
          q: trimmedQuery,
          limit: "50",
        });
        if (projectId) {
          params.set("projectId", projectId);
        }
        if (excludeCurrentMembers) {
          params.set("excludeCurrentMembers", "true");
        }
        const response = await fetch(`/api/v1/projects/candidates?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const json = (await response.json()) as { data?: ProjectCandidateUserDTO[] };
        if (Array.isArray(json.data)) {
          setRemoteResult({ query: trimmedQuery, items: json.data });
        }
      } catch {
        // Ignore aborted or transient search requests; initial server options remain usable
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled, excludeCurrentMembers, kind, projectId, trimmedQuery]);

  const items =
    trimmedQuery && remoteResult?.query === trimmedQuery ? remoteResult.items : initialItems;

  return {
    query,
    setQuery,
    items,
    searching: Boolean(trimmedQuery) && searching,
  };
}

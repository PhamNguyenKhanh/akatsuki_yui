import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildUpdatedQueryUrl,
  parsePositivePageParam,
  parseSafeQueryEnum,
  pickSingleSearchParam,
} from "@/lib/search-params";

describe("Sprint 7 Regression — Search Params Pagination & Free-Tier Background Policy", () => {
  it("normalizes invalid, negative, overflow, and array URL pagination parameters safely", () => {
    expect(pickSingleSearchParam(["  hello  ", "world"])).toBe("hello");
    expect(pickSingleSearchParam("   ")).toBeUndefined();

    expect(parsePositivePageParam(undefined)).toBe(1);
    expect(parsePositivePageParam("abc", 1)).toBe(1);
    expect(parsePositivePageParam("-9", 1)).toBe(1);
    expect(parsePositivePageParam("0", 1)).toBe(1);
    expect(parsePositivePageParam("99999999", 1)).toBe(10000);
    expect(parsePositivePageParam("3", 1)).toBe(3);

    const statusSchema = z.enum(["all", "unread", "read"]);
    expect(parseSafeQueryEnum(statusSchema, "unread")).toBe("unread");
    expect(parseSafeQueryEnum(statusSchema, "MALICIOUS")).toBeUndefined();

    expect(
      buildUpdatedQueryUrl("/documents", {
        page: 2,
        search: "  specs  ",
        category: undefined,
        projectId: null,
      })
    ).toBe("/documents?page=2&search=specs");

    expect(buildUpdatedQueryUrl("/notifications", { page: undefined })).toBe("/notifications");
  });

  it("enforces zero client polling in NotificationBell and single daily Cron schedule in vercel.json", () => {
    const bellSource = readFileSync(
      path.join(process.cwd(), "src/components/features/notifications/notification-bell.tsx"),
      "utf8"
    );

    expect(bellSource).not.toMatch(/\bsetInterval\s*\(/);
    expect(bellSource).not.toContain("usePathname");
    expect(bellSource).toContain("initialUnreadCount");

    const vercelConfig = JSON.parse(
      readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
    ) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(vercelConfig.crons).toEqual([
      {
        path: "/api/internal/notifications/process",
        schedule: "0 1 * * *",
      },
    ]);
  });
});

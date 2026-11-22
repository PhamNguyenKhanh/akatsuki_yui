export type DocumentBrandKey =
  | "google-drive"
  | "google-docs"
  | "figma"
  | "github"
  | "postman"
  | "notion"
  | "canva"
  | "vercel"
  | "miro"
  | "trello"
  | "swagger"
  | "web";

export interface DocumentBrandInfo {
  key: DocumentBrandKey;
  label: string;
  badgeClassName: string;
}

const BRAND_MAP: Record<DocumentBrandKey, Omit<DocumentBrandInfo, "key">> = {
  "google-drive": {
    label: "Google Drive",
    badgeClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  "google-docs": {
    label: "Google Docs",
    badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  figma: {
    label: "Figma",
    badgeClassName: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
  github: {
    label: "GitHub",
    badgeClassName: "border-slate-500/30 bg-slate-500/10 text-slate-800 dark:text-slate-200",
  },
  postman: {
    label: "Postman",
    badgeClassName: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  notion: {
    label: "Notion",
    badgeClassName: "border-zinc-500/30 bg-zinc-500/10 text-zinc-800 dark:text-zinc-200",
  },
  canva: {
    label: "Canva",
    badgeClassName: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  vercel: {
    label: "Vercel",
    badgeClassName: "border-neutral-500/30 bg-neutral-500/10 text-neutral-800 dark:text-neutral-200",
  },
  miro: {
    label: "Miro",
    badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  trello: {
    label: "Trello",
    badgeClassName: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  swagger: {
    label: "Swagger / API",
    badgeClassName: "border-lime-500/30 bg-lime-500/10 text-lime-800 dark:text-lime-300",
  },
  web: {
    label: "Web Link",
    badgeClassName: "border-border bg-muted/60 text-muted-foreground",
  },
};

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function detectDocumentBrand(rawUrl: string | null | undefined): DocumentBrandInfo {
  if (!rawUrl) {
    return { key: "web", ...BRAND_MAP.web };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { key: "web", ...BRAND_MAP.web };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  let key: DocumentBrandKey = "web";
  if (host === "drive.google.com") key = "google-drive";
  else if (host === "docs.google.com") key = "google-docs";
  else if (matchesDomain(host, "figma.com")) key = "figma";
  else if (matchesDomain(host, "github.com")) key = "github";
  else if (matchesDomain(host, "postman.co") || matchesDomain(host, "postman.com")) key = "postman";
  else if (matchesDomain(host, "notion.so") || matchesDomain(host, "notion.site")) key = "notion";
  else if (matchesDomain(host, "canva.com")) key = "canva";
  else if (matchesDomain(host, "vercel.app") || matchesDomain(host, "vercel.com")) key = "vercel";
  else if (matchesDomain(host, "miro.com")) key = "miro";
  else if (matchesDomain(host, "trello.com")) key = "trello";
  else if (
    matchesDomain(host, "swagger.io") ||
    path.includes("/swagger") ||
    path.includes("/api-docs")
  ) {
    key = "swagger";
  }

  return { key, ...BRAND_MAP[key] };
}

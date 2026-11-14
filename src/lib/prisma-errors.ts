import { Prisma } from "@prisma/client";

export function isPrismaUniqueViolation(error: unknown, constraintHints?: string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  if (!constraintHints || constraintHints.length === 0) {
    return true;
  }

  const targetMeta = error.meta?.target;
  const targetText = Array.isArray(targetMeta)
    ? targetMeta.map(String).join(" ")
    : typeof targetMeta === "string"
      ? targetMeta
      : "";
  const haystack = `${targetText} ${error.message}`.toLowerCase();

  return constraintHints.some((hint) => haystack.includes(hint.toLowerCase()));
}

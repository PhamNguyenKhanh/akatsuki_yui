"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UrlPaginationControlsProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  itemLabel?: string;
  isLoading?: boolean;
  onPageChange: (nextPage: number) => void;
}

export function UrlPaginationControls({
  page,
  pageSize,
  totalItems,
  totalPages,
  itemLabel = "mục",
  isLoading = false,
  onPageChange,
}: UrlPaginationControlsProps) {
  if (totalItems === 0 && page <= 1) {
    return null;
  }

  const safeTotalPages = Math.max(1, totalPages);
  const startIndex = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        {totalItems > 0 ? (
          <span>
            Hiển thị{" "}
            <span className="font-medium text-foreground">
              {startIndex}–{endIndex}
            </span>{" "}
            / <span className="font-medium text-foreground">{totalItems}</span> {itemLabel} · Trang{" "}
            <span className="font-medium text-foreground">{page}</span>/{safeTotalPages}
          </span>
        ) : (
          <span>
            Không có {itemLabel} ở trang {page} · Trang{" "}
            <span className="font-medium text-foreground">{page}</span>/{safeTotalPages}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Trước</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
          disabled={page >= safeTotalPages || isLoading}
        >
          <span>Sau</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

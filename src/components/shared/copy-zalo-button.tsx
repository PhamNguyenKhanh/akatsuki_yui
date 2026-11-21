"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CopyZaloButtonProps {
  getText: () => string;
  label?: string;
  successMessage?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  title?: string;
  className?: string;
}

export function CopyZaloButton({
  getText,
  label = "Copy Zalo",
  successMessage = "Đã sao chép tóm tắt chuẩn Zalo.",
  size = "sm",
  variant = "outline",
  title = "Sao chép tóm tắt chuẩn Zalo",
  className,
}: CopyZaloButtonProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      const text = getText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(successMessage);
    } catch {
      toast.error("Không thể sao chép tự động, vui lòng copy thủ công.");
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => void handleCopy()}
      title={title}
      className={className}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {label ? <span>{copied ? "Đã copy" : label}</span> : null}
    </Button>
  );
}

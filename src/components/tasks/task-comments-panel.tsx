"use client";

import * as React from "react";
import { AtSign, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getPusherClient } from "@/lib/pusher-client";
import { getTaskCommentsChannel, PUSHER_EVENTS } from "@/lib/pusher-channels";
import { usePropSyncedState } from "@/lib/use-prop-synced-state";
import {
  createTaskCommentAction,
  deleteTaskCommentAction,
} from "@/modules/tasks/task-comment.actions";
import type {
  TaskCommentDTO,
  TaskMentionableMemberDTO,
} from "@/modules/tasks/task-comment.service";

interface TaskCommentsPanelProps {
  projectId: string;
  taskId: string;
  currentUserId: string;
  isLeaderOrAdmin: boolean;
  isArchived: boolean;
  initialComments: TaskCommentDTO[];
  mentionableMembers: TaskMentionableMemberDTO[];
}

function formatCommentTimeVi(isoString: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function renderContentWithMentions(
  content: string,
  mentionedMembers: TaskMentionableMemberDTO[]
): React.ReactNode {
  if (mentionedMembers.length === 0) {
    return content;
  }

  const names = mentionedMembers
    .map((m) => m.fullName.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (names.length === 0) {
    return content;
  }

  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(@(?:${escaped.join("|")}))(?=$|\\s|[.,!?;:])`, "g");
  const segments = content.split(regex);

  return segments.map((segment, index) => {
    if (segment.startsWith("@") && names.some((n) => segment === `@${n}`)) {
      return (
        <span
          key={`${index}-${segment}`}
          className="rounded bg-primary/10 px-1 py-0.5 font-medium text-primary"
        >
          {segment}
        </span>
      );
    }
    return <React.Fragment key={index}>{segment}</React.Fragment>;
  });
}

export function TaskCommentsPanel({
  projectId,
  taskId,
  currentUserId,
  isLeaderOrAdmin,
  isArchived,
  initialComments,
  mentionableMembers,
}: TaskCommentsPanelProps) {
  const [comments, setComments] = usePropSyncedState<TaskCommentDTO[]>(initialComments);
  const [content, setContent] = React.useState("");
  const [selectedMentionIds, setSelectedMentionIds] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const memberById = React.useMemo(() => {
    const map = new Map<string, TaskMentionableMemberDTO>();
    for (const member of mentionableMembers) {
      map.set(member.userId, member);
    }
    return map;
  }, [mentionableMembers]);

  const mentionCandidates = React.useMemo(() => {
    const others = mentionableMembers.filter((m) => m.userId !== currentUserId);
    if (mentionQuery === null) return [];
    const needle = mentionQuery.trim().toLowerCase();
    if (!needle) return others;
    return others.filter(
      (m) =>
        m.fullName.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle)
    );
  }, [mentionableMembers, currentUserId, mentionQuery]);

  React.useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = getTaskCommentsChannel(taskId);
    const channel = pusher.subscribe(channelName);

    const handleSubscribed = () => setRealtimeConnected(true);
    const handleCreated = (incoming: TaskCommentDTO) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === incoming.id)) {
          return prev;
        }
        return [...prev, incoming];
      });
    };
    const handleDeleted = (payload: { commentId?: string }) => {
      if (!payload?.commentId) return;
      setComments((prev) => prev.filter((c) => c.id !== payload.commentId));
    };

    channel.bind("pusher:subscription_succeeded", handleSubscribed);
    channel.bind(PUSHER_EVENTS.TASK_COMMENT_CREATED, handleCreated);
    channel.bind(PUSHER_EVENTS.TASK_COMMENT_DELETED, handleDeleted);

    return () => {
      channel.unbind("pusher:subscription_succeeded", handleSubscribed);
      channel.unbind(PUSHER_EVENTS.TASK_COMMENT_CREATED, handleCreated);
      channel.unbind(PUSHER_EVENTS.TASK_COMMENT_DELETED, handleDeleted);
      pusher.unsubscribe(channelName);
      setRealtimeConnected(false);
    };
  }, [taskId, setComments]);

  function handleContentChange(value: string) {
    setContent(value);

    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)@([^\s@\n]*)$/);
    if (match) {
      setMentionQuery(match[1] ?? "");
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(member: TaskMentionableMemberDTO) {
    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart ?? content.length;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    const match = textBeforeCursor.match(/(?:^|\s)@([^\s@\n]*)$/);
    let nextContent: string;
    if (match && match.index !== undefined) {
      const prefixSpace = match[0].startsWith("@") ? "" : match[0][0];
      const replaceStart = match.index + prefixSpace.length;
      nextContent = `${content.slice(0, replaceStart)}@${member.fullName} ${textAfterCursor}`;
    } else {
      const separator = content.length === 0 || /\s$/.test(content) ? "" : " ";
      nextContent = `${content}${separator}@${member.fullName} `;
    }

    setContent(nextContent);
    setSelectedMentionIds((prev) =>
      prev.includes(member.userId) ? prev : [...prev, member.userId]
    );
    setMentionQuery(null);

    window.requestAnimationFrame(() => {
      textarea?.focus();
    });
  }

  function removeSelectedMention(userId: string) {
    setSelectedMentionIds((prev) => prev.filter((id) => id !== userId));
  }

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting || isArchived) return;

    // Also detect any @FullName present in content in case user typed it manually
    const matchedMentionIds = new Set<string>(selectedMentionIds);
    for (const member of mentionableMembers) {
      if (member.userId !== currentUserId && trimmed.includes(`@${member.fullName}`)) {
        matchedMentionIds.add(member.userId);
      }
    }

    setSubmitting(true);
    const result = await createTaskCommentAction(taskId, projectId, {
      content: trimmed,
      mentionedUserIds: Array.from(matchedMentionIds),
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setComments((prev) => (prev.some((c) => c.id === result.data.id) ? prev : [...prev, result.data]));
    setContent("");
    setSelectedMentionIds([]);
    setMentionQuery(null);
  }

  async function handleDelete(commentId: string) {
    setDeletingId(commentId);
    const result = await deleteTaskCommentAction(taskId, projectId, commentId);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
    toast.success("Đã xóa bình luận.");
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>Trao đổi &amp; Bình luận ({comments.length})</span>
            {realtimeConnected && (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-50 text-[11px] font-medium text-emerald-700"
              >
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Realtime
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Thảo luận trực tiếp trên Task. Gõ <code className="font-mono">@</code> để nhắc tên và
            gửi thông báo realtime cho thành viên.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Chưa có bình luận nào. Hãy bắt đầu trao đổi hoặc gõ @ để nhắc thành viên.
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const canDelete =
                !isArchived && (comment.author.id === currentUserId || isLeaderOrAdmin);
              const mentionedMembers = comment.mentionedUserIds
                .map((id) => memberById.get(id))
                .filter((m): m is TaskMentionableMemberDTO => Boolean(m));

              return (
                <div
                  key={comment.id}
                  className="flex gap-3 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(comment.author.fullName)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {comment.author.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCommentTimeVi(comment.createdAt)}
                        </span>
                      </div>
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === comment.id}
                          onClick={() => void handleDelete(comment.id)}
                          title="Xóa bình luận"
                        >
                          {deletingId === comment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                      {renderContentWithMentions(comment.content, mentionedMembers)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isArchived && (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 border-t border-border pt-4">
            <div className="relative space-y-2">
              {mentionQuery !== null && mentionCandidates.length > 0 && (
                <div className="rounded-md border border-border bg-popover p-1 shadow-md">
                  <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    Chọn thành viên để nhắc (@mention)
                  </p>
                  <div className="max-h-44 overflow-y-auto">
                    {mentionCandidates.map((member) => (
                      <button
                        key={member.userId}
                        type="button"
                        onClick={() => insertMention(member)}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span className="font-medium">{member.fullName}</span>
                        <span className="text-xs text-muted-foreground">{member.projectRole}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Textarea
                ref={textareaRef}
                rows={3}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="Nhập bình luận... (Gõ @ để nhắc thành viên, Ctrl+Enter để gửi)"
                disabled={submitting}
              />
            </div>

            {selectedMentionIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Sẽ thông báo tới:</span>
                {selectedMentionIds.map((userId) => {
                  const member = memberById.get(userId);
                  if (!member) return null;
                  return (
                    <Badge
                      key={userId}
                      variant="secondary"
                      className="cursor-pointer gap-1 text-xs"
                      onClick={() => removeSelectedMention(userId)}
                      title="Bấm để bỏ nhắc tên"
                    >
                      @{member.fullName} ×
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {mentionableMembers
                  .filter((m) => m.userId !== currentUserId)
                  .slice(0, 6)
                  .map((member) => (
                    <Button
                      key={member.userId}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => insertMention(member)}
                    >
                      <AtSign className="h-3 w-3" />
                      <span>{member.fullName}</span>
                    </Button>
                  ))}
              </div>

              <Button type="submit" size="sm" disabled={submitting || !content.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Gửi bình luận</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

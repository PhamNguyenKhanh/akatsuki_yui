import { NextRequest, NextResponse } from "next/server";
import { getPusherServer } from "@/lib/pusher-server";
import { uuidSchema } from "@/lib/validations/common";
import { PERMISSIONS } from "@/modules/authorization/constants";
import { hasPermission } from "@/modules/authorization/policy.service";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { assertTaskReadAccess } from "@/modules/tasks/task.access";

export async function POST(request: NextRequest) {
  try {
    const pusher = getPusherServer();
    if (!pusher) {
      return NextResponse.json({ error: "Pusher is not configured." }, { status: 503 });
    }

    const actor = await requireActiveUser();
    const contentType = request.headers.get("content-type") ?? "";

    let socketId = "";
    let channelName = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { socket_id?: unknown; channel_name?: unknown };
      socketId = typeof body.socket_id === "string" ? body.socket_id : "";
      channelName = typeof body.channel_name === "string" ? body.channel_name : "";
    } else {
      const rawText = await request.text();
      const params = new URLSearchParams(rawText);
      socketId = params.get("socket_id") ?? "";
      channelName = params.get("channel_name") ?? "";
    }

    if (!socketId || !channelName) {
      return NextResponse.json({ error: "Missing socket_id or channel_name." }, { status: 400 });
    }

    if (channelName.startsWith("private-user-")) {
      const targetUserId = channelName.slice("private-user-".length);
      if (targetUserId !== actor.userId) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (channelName.startsWith("private-task-")) {
      const taskId = channelName.slice("private-task-".length);
      if (!uuidSchema.safeParse(taskId).success) {
        return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
      }
      if (!hasPermission(actor, PERMISSIONS.TASK_READ)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
      await assertTaskReadAccess(actor, taskId);
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    return NextResponse.json({ error: "Unsupported channel." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }
}

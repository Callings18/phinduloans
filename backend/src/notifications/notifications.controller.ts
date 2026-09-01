import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HttpStatus } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth-user";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { apiFail } from "../common/http";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  @ApiOperation({ summary: "Current user in-app notifications" })
  async me(@CurrentUser() user: AuthUser) {
    const data = await this.prisma.notificationLog.findMany({
      where: { user_id: user.userId },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    return { ok: true, data };
  }

  @Post(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  async markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.notificationLog.findUnique({
      where: { id },
      select: { id: true, user_id: true },
    });
    if (!row) {
      apiFail(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "Notification not found");
    }
    if (row.user_id !== user.userId) {
      apiFail(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot mark another user's notification as read");
    }
    await this.prisma.notificationLog.update({
      where: { id },
      data: { status: "read" },
    });
    return { ok: true, data: { id, status: "read" } };
  }
}

import { NotificationType } from "@prisma/client";

export interface NotificationMetadata {
  timeEntryId?: string;
  actorId?: string;
  actorName?: string;
  projectId?: string;
  projectName?: string;
  rejectionComment?: string;
  userId?: string;
  userName?: string;
}

export interface CreateNotificationParams {
  userId: string;
  companyId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}

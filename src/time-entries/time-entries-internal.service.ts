import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * Internal utilities for TimeEntries. Shared by ActionService (sync overlap logic).
 * No external dependencies beyond Prisma transaction client passed by caller.
 */
@Injectable()
export class TimeEntriesInternalService {
  private readonly logger = new Logger(TimeEntriesInternalService.name);

  /**
   * Ensures no RUNNING/PAUSED overlap for userId. If active entry exists, auto-stops it (Hubstaff-style).
   * Must be called within a transaction before creating a new RUNNING/PAUSED entry.
   */
  async ensureNoActiveOverlapOrAutoStop(
    tx: Prisma.TransactionClient,
    userId: string,
    companyId: string,
  ): Promise<void> {
    const activeEntry = await tx.timeEntry.findFirst({
      where: {
        userId,
        status: { in: ["RUNNING", "PAUSED"] },
        user: { companyId },
      },
      select: {
        id: true,
        startTime: true,
        duration: true,
        status: true,
      },
    });

    if (!activeEntry) return;

    const now = new Date();
    let finalDuration = activeEntry.duration;
    if (activeEntry.status === "RUNNING") {
      const elapsed = Math.floor(
        (now.getTime() - new Date(activeEntry.startTime).getTime()) / 1000,
      );
      finalDuration = activeEntry.duration + Math.max(0, elapsed);
    }

    await tx.timeEntry.update({
      where: { id: activeEntry.id },
      data: {
        status: "STOPPED",
        endTime: now,
        duration: finalDuration,
        approvalStatus: "PENDING",
      },
    });

    this.logger.debug(
      { activeEntryId: activeEntry.id, userId },
      "Auto-stopped previous active timer before creating new RUNNING/PAUSED entry",
    );
  }
}

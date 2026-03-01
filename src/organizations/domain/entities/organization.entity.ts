import {
  OrganizationPlan,
  IdleAction,
  OrganizationRole,
  MemberStatus,
} from "@prisma/client";
import { OrganizationName } from "../value-objects/organization-name.vo";

export class Organization {
  constructor(
    public readonly id: string,
    public _name: OrganizationName,
    public readonly ownerId: string,
    // Настройки трекинга
    public screenshotInterval: number = 600,
    public allowBlur: boolean = false,
    public trackApps: boolean = true,
    public trackUrls: boolean = true,
    public idleTimeout: number = 0,
    public idleAction: IdleAction = IdleAction.ASK_USER,
    // Параметры организации
    public plan: OrganizationPlan = OrganizationPlan.FREE,
    public currency: string = "USD",
    public weekStart: number = 1,
    public settings: any = null, // Для произвольных Json данных
    // Системные
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  get name(): string {
    return this._name.getValue();
  }

  public downgradeToFree() {
    this.plan = OrganizationPlan.FREE;
    this.allowBlur = false;
    this.updatedAt = new Date();
  }

  public updateTrackingSettings(
    interval: number,
    blur: boolean,
    idleTimeout: number,
  ) {
    if (interval < 60)
      throw new Error("Screenshot interval must be at least 60 seconds");

    this.screenshotInterval = interval;
    this.allowBlur = blur;
    this.idleTimeout = idleTimeout;
    this.updatedAt = new Date();
  }

  public rename(newName: string) {
    this._name = new OrganizationName(newName);
    this.updatedAt = new Date();
  }

  public canAddMoreMembers(currentCount: number): boolean {
    if (this.plan === OrganizationPlan.FREE && currentCount >= 5) return false;
    return true;
  }

  public createMember(
    userId: string,
    role: OrganizationRole = OrganizationRole.EMPLOYEE,
  ) {
    return {
      organizationId: this.id,
      userId,
      role,
      status: MemberStatus.ACTIVE,
      joinedAt: new Date(),
    };
  }

  public canAddMember(currentMemberCount: number): boolean {
    const LIMITS = { FREE: 5, STARTER: 10, PRO: 50, ENTERPRISE: 100 };

    return currentMemberCount < LIMITS[this.plan];
  }
}

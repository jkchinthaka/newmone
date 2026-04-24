import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RoleName, TenantInvitationStatus, TenantMembershipRole } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { TenancyService } from "../tenancy/tenancy.service";
import { CreateTenantInvitationDto } from "./dto/create-tenant-invitation.dto";

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenancyService) private readonly tenancyService: TenancyService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  private assertCanManageInvites(userRole: RoleName, membershipRole: TenantMembershipRole) {
    if (userRole === RoleName.SUPER_ADMIN) {
      return;
    }

    if (
      ![
        TenantMembershipRole.OWNER,
        TenantMembershipRole.ADMIN,
        TenantMembershipRole.BILLING
      ].includes(membershipRole)
    ) {
      throw new ForbiddenException("Insufficient tenant permissions to manage invitations");
    }
  }

  async listInvitations(actorUserId: string, tenantId: string) {
    const access = await this.tenancyService.ensureTenantAccess(actorUserId, tenantId);
    this.assertCanManageInvites(access.user.role.name, access.membershipRole);

    return this.prisma.tenantInvitation.findMany({
      where: {
        tenantId
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });
  }

  async createInvitation(
    actorUserId: string,
    tenantId: string,
    dto: CreateTenantInvitationDto
  ) {
    const access = await this.tenancyService.ensureTenantAccess(actorUserId, tenantId);
    this.assertCanManageInvites(access.user.role.name, access.membershipRole);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true
      }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true
      }
    });

    if (existingUser) {
      const existingMembership = await this.prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: existingUser.id
          }
        },
        select: {
          id: true
        }
      });

      if (existingMembership) {
        throw new BadRequestException("User already belongs to this tenant");
      }
    }

    const token = randomUUID();
    const expiresInDays = dto.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const currentPending = await this.prisma.tenantInvitation.findFirst({
      where: {
        tenantId,
        email,
        status: TenantInvitationStatus.PENDING,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const invitation = currentPending
      ? await this.prisma.tenantInvitation.update({
          where: { id: currentPending.id },
          data: {
            token,
            invitedById: actorUserId,
            membershipRole: dto.membershipRole ?? TenantMembershipRole.MEMBER,
            firstName: dto.firstName?.trim() || null,
            lastName: dto.lastName?.trim() || null,
            expiresAt,
            status: TenantInvitationStatus.PENDING,
            acceptedAt: null
          }
        })
      : await this.prisma.tenantInvitation.create({
          data: {
            tenantId,
            invitedById: actorUserId,
            email,
            firstName: dto.firstName?.trim() || null,
            lastName: dto.lastName?.trim() || null,
            membershipRole: dto.membershipRole ?? TenantMembershipRole.MEMBER,
            token,
            expiresAt,
            status: TenantInvitationStatus.PENDING
          }
        });

    const frontendBaseUrl = this.configService.get<string>("FRONTEND_URL") ?? "http://localhost:3001";
    const invitationLink = `${frontendBaseUrl}/invite/accept?token=${invitation.token}`;

    return {
      ...invitation,
      invitationLink,
      tenantName: tenant.name
    };
  }
}

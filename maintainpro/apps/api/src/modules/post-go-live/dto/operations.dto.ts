import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import {
  ChangeRequestImpact,
  ChangeRequestStatus,
  HypercareReadinessStatus,
  ReleaseStatus,
  ReleaseType,
  SupportEnvironment,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketSeverity,
  SupportTicketStatus,
  TrainingCategory,
  TrainingStatus,
  EscalationNotificationMethod,
  SupportTicketSeverity as EscSeverity
} from "@prisma/client";

export class OperationsListQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsString() reportedBy?: string;
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

export class CreateTrainingDto {
  @IsEnum(TrainingCategory) category!: TrainingCategory;
  @IsString() role!: string;
  @IsString() traineeUserId!: string;
  @IsOptional() @IsString() trainerUserId?: string;
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsArray() checklistItems?: string[];
  @IsOptional() @IsDateString() trainingDate?: string;
}

export class UpdateTrainingDto {
  @IsOptional() @IsEnum(TrainingStatus) status?: TrainingStatus;
  @IsOptional() @IsString() @MaxLength(4000) evidence?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsDateString() trainingDate?: string;
}

export class CreateSupportTicketDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(8000) description!: string;
  @IsEnum(SupportTicketCategory) category!: SupportTicketCategory;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  @IsOptional() @IsEnum(SupportTicketSeverity) severity?: SupportTicketSeverity;
  @IsOptional() @IsString() affectedModule?: string;
  @IsOptional() @IsString() affectedPage?: string;
  @IsOptional() @IsString() affectedRole?: string;
  @IsOptional() @IsEnum(SupportEnvironment) environment?: SupportEnvironment;
  @IsOptional() @IsString() businessImpact?: string;
}

export class UpdateSupportTicketDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  @IsOptional() @IsString() workaround?: string;
  @IsOptional() @IsString() rootCause?: string;
}

export class AssignTicketDto {
  @IsString() assignedToUserId!: string;
  @IsOptional() @IsString() reason?: string;
}

export class TicketStatusDto {
  @IsEnum(SupportTicketStatus) status!: SupportTicketStatus;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class ResolveTicketDto {
  @IsString() @MinLength(10) resolutionNote!: string;
  @IsOptional() @IsString() rootCause?: string;
  @IsOptional() @IsString() workaround?: string;
}

export class CloseTicketDto {
  @IsString() @MinLength(10) resolutionNote!: string;
}

export class ReopenTicketDto {
  @IsString() @MinLength(10) reason!: string;
}

export class CreateChangeRequestDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) description!: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() affectedModule?: string;
  @IsOptional() @IsString() businessReason?: string;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  @IsOptional() @IsEnum(ChangeRequestImpact) impactLevel?: ChangeRequestImpact;
  @IsOptional() @IsString() estimatedEffort?: string;
  @IsOptional() @IsNumber() estimatedCost?: number;
  @IsOptional() @IsString() linkedTicketId?: string;
}

export class ApproveChangeRequestDto {
  @IsOptional() @IsString() approvalNote?: string;
}

export class RejectChangeRequestDto {
  @IsString() @MinLength(10) rejectionReason!: string;
}

export class ChangeRequestStatusDto {
  @IsEnum(ChangeRequestStatus) status!: ChangeRequestStatus;
  @IsOptional() @IsString() reason?: string;
}

export class CreateReleaseDto {
  @IsString() version!: string;
  @IsString() @MinLength(3) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ReleaseType) releaseType?: ReleaseType;
  @IsOptional() @IsString() releaseNotes?: string;
  @IsOptional() @IsString() rollbackPlan?: string;
  @IsOptional() @IsBoolean() backupTaken?: boolean;
  @IsOptional() @IsString() backupReference?: string;
  @IsOptional() @IsArray() linkedChangeRequests?: string[];
}

export class UpdateReleaseDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() releaseNotes?: string;
  @IsOptional() @IsString() rollbackPlan?: string;
  @IsOptional() @IsBoolean() backupTaken?: boolean;
  @IsOptional() @IsString() backupReference?: string;
  @IsOptional() @IsString() commitHash?: string;
}

export class MarkDeployedDto {
  @IsOptional() @IsString() renderDeployId?: string;
  @IsOptional() @IsString() cloudflareDeployId?: string;
  @IsOptional() @IsString() commitHash?: string;
}

export class RollbackReleaseDto {
  @IsString() @MinLength(10) reason!: string;
}

export class CreateHypercareDto {
  @IsString() hypercarePeriodName!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() supportOwner?: string;
}

export class UpdateHypercareDto {
  @IsOptional() @IsEnum(HypercareReadinessStatus) readinessStatus?: HypercareReadinessStatus;
  @IsOptional() @IsString() userFeedback?: string;
  @IsOptional() @IsString() trainingGaps?: string;
  @IsOptional() @IsInt() dailyIssueCount?: number;
}

export class ExtendHypercareDto {
  @IsDateString() endDate!: string;
  @IsString() @MinLength(10) reason!: string;
}

export class CompleteHypercareDto {
  @IsOptional() @IsString() notes?: string;
}

export class UpdateHandoverDto {
  @IsOptional() @IsString() systemUrls?: string;
  @IsOptional() @IsString() rolesResponsibilities?: string;
  @IsOptional() @IsString() supportContacts?: string;
  @IsOptional() @IsString() escalationMatrix?: string;
  @IsOptional() @IsString() backupProcess?: string;
  @IsOptional() @IsString() restoreProcess?: string;
  @IsOptional() @IsString() deploymentProcess?: string;
  @IsOptional() @IsString() rollbackProcess?: string;
  @IsOptional() @IsString() knownLimitations?: string;
  @IsOptional() @IsString() commonIssuesFixes?: string;
  @IsOptional() @IsString() trainingMaterials?: string;
  @IsOptional() @IsString() changeRequestProcess?: string;
  @IsOptional() @IsString() incidentProcess?: string;
}

export class CreateEscalationRuleDto {
  @IsOptional() @IsEnum(SupportTicketCategory) category?: SupportTicketCategory;
  @IsOptional() @IsEnum(EscSeverity) severity?: EscSeverity;
  @IsInt() escalationLevel!: number;
  @IsString() responsibleRole!: string;
  @IsOptional() @IsString() responsibleUserId?: string;
  @IsOptional() @IsInt() responseTimeMinutes?: number;
  @IsInt() escalationAfterMinutes!: number;
  @IsOptional() @IsEnum(EscalationNotificationMethod) notificationMethod?: EscalationNotificationMethod;
}

export class UpdateEscalationRuleDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() escalationAfterMinutes?: number;
  @IsOptional() @IsString() responsibleRole?: string;
}

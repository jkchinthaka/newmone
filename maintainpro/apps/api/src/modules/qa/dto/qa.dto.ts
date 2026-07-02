import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import {
  QaEnvironment,
  QaIssueCategory,
  QaIssuePriority,
  QaIssueSeverity,
  QaIssueStatus,
  QaRegressionResult,
  QaRootCauseType
} from "@prisma/client";

export class QaIssueListQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsString() environment?: string;
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsString() reportedBy?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() uatPhase?: string;
  @IsOptional() @IsString() knownOnly?: string;
}

export class CreateQaIssueDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(10) @MaxLength(8000) description!: string;
  @IsEnum(QaIssueCategory) category!: QaIssueCategory;
  @IsOptional() @IsString() @MaxLength(120) subCategory?: string;
  @IsOptional() @IsEnum(QaIssueSeverity) severity?: QaIssueSeverity;
  @IsOptional() @IsEnum(QaIssuePriority) priority?: QaIssuePriority;
  @IsOptional() @IsString() @MaxLength(120) affectedModule?: string;
  @IsOptional() @IsString() @MaxLength(240) affectedPage?: string;
  @IsOptional() @IsString() @MaxLength(240) affectedApi?: string;
  @IsOptional() @IsEnum(QaEnvironment) environment?: QaEnvironment;
  @IsOptional() @IsString() @MaxLength(4000) reproductionSteps?: string;
  @IsOptional() @IsString() @MaxLength(2000) expectedResult?: string;
  @IsOptional() @IsString() @MaxLength(2000) actualResult?: string;
  @IsOptional() @IsString() @MaxLength(2000) businessImpact?: string;
  @IsOptional() @IsString() @MaxLength(2000) userImpact?: string;
  @IsOptional() @IsString() linkedUatPhase?: string;
  @IsOptional() @IsString() linkedWorkOrderId?: string;
}

export class UpdateQaIssueDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsEnum(QaIssueCategory) category?: QaIssueCategory;
  @IsOptional() @IsString() subCategory?: string;
  @IsOptional() @IsEnum(QaIssueSeverity) severity?: QaIssueSeverity;
  @IsOptional() @IsEnum(QaIssuePriority) priority?: QaIssuePriority;
  @IsOptional() @IsString() affectedModule?: string;
  @IsOptional() @IsString() affectedPage?: string;
  @IsOptional() @IsString() affectedApi?: string;
  @IsOptional() @IsString() fixSummary?: string;
  @IsOptional() @IsString() workaround?: string;
  @IsOptional() @IsString() regressionRisk?: string;
  @IsOptional() @IsString() linkedCommitHash?: string;
  @IsOptional() @IsString() linkedDeployId?: string;
  @IsOptional() @IsString() linkedUatPhase?: string;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class QaStatusChangeDto {
  @IsEnum(QaIssueStatus) status!: QaIssueStatus;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) resolutionNote?: string;
}

export class QaAssignDto {
  @IsString() assignedToUserId!: string;
  @IsOptional() @IsString() reason?: string;
}

export class QaTriageDto {
  @IsOptional() @IsEnum(QaIssueSeverity) severity?: QaIssueSeverity;
  @IsOptional() @IsEnum(QaIssuePriority) priority?: QaIssuePriority;
  @IsOptional() @IsString() ownerDepartment?: string;
  @IsOptional() @IsString() reason?: string;
}

export class QaRcaDto {
  @IsEnum(QaRootCauseType) rootCauseType!: QaRootCauseType;
  @IsString() @MinLength(10) explanation!: string;
  @IsOptional() @IsString() preventiveAction?: string;
  @IsOptional() @IsString() ownerUserId?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() verificationStatus?: string;
}

export class QaRegressionTestDto {
  @IsString() @MinLength(3) testCase!: string;
  @IsOptional() @IsString() roleUsed?: string;
  @IsEnum(QaEnvironment) environment!: QaEnvironment;
  @IsEnum(QaRegressionResult) result!: QaRegressionResult;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() reference?: string;
}

export class QaAcceptRiskDto {
  @IsString() @MinLength(10) reason!: string;
  @IsOptional() @IsString() knownLimitation?: string;
  @IsOptional() @IsString() futureFixPlan?: string;
  @IsOptional() @IsDateString() riskReviewDate?: string;
}

export class QaReopenDto {
  @IsString() @MinLength(10) reason!: string;
}

export class QaCloseDto {
  @IsString() @MinLength(10) resolutionNote!: string;
  @IsOptional() @IsString() fixSummary?: string;
}

export class QaReleaseReportQueryDto {
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() uatPhase?: string;
  @IsOptional() @IsString() environment?: string;
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() status?: string;
}

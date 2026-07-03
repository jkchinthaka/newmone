import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength
} from "class-validator";
import {
  CutoverChecklistCategory,
  CutoverItemStatus,
  GoLiveDecisionOption,
  GoLiveSignOffDecision,
  PilotRolloutStatus,
  RollbackTestedStatus,
  RolloutWaveStatus
} from "@prisma/client";

export class GoLiveListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class CreatePilotRolloutDto {
  @IsString()
  @IsNotEmpty()
  pilotName!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  pilotOwnerUserId?: string;

  @IsOptional()
  @IsArray()
  selectedUsers?: string[];

  @IsOptional()
  @IsArray()
  selectedRoles?: string[];

  @IsOptional()
  @IsArray()
  selectedModules?: string[];

  @IsOptional()
  @IsString()
  successCriteria?: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePilotRolloutDto {
  @IsOptional()
  @IsString()
  pilotName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  pilotOwnerUserId?: string;

  @IsOptional()
  @IsArray()
  selectedUsers?: string[];

  @IsOptional()
  @IsEnum(PilotRolloutStatus)
  status?: PilotRolloutStatus;

  @IsOptional()
  @IsString()
  userFeedback?: string;

  @IsOptional()
  @IsString()
  managerFeedback?: string;

  @IsOptional()
  @IsString()
  pilotResult?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExtendPilotDto {
  @IsString()
  @MinLength(5)
  reason!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CreateCutoverItemDto {
  @IsEnum(CutoverChecklistCategory)
  category!: CutoverChecklistCategory;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  blocker?: boolean;
}

export class UpdateCutoverItemDto {
  @IsOptional()
  @IsEnum(CutoverItemStatus)
  status?: CutoverItemStatus;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  evidence?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateRolloutWaveDto {
  @IsInt()
  @Min(1)
  waveNo!: number;

  @IsString()
  @IsNotEmpty()
  waveName!: string;

  @IsOptional()
  @IsArray()
  departments?: string[];

  @IsOptional()
  @IsArray()
  branches?: string[];

  @IsOptional()
  @IsArray()
  roles?: string[];

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @IsOptional()
  @IsString()
  successCriteria?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRolloutWaveDto {
  @IsOptional()
  @IsString()
  waveName?: string;

  @IsOptional()
  @IsEnum(RolloutWaveStatus)
  status?: RolloutWaveStatus;

  @IsOptional()
  @IsArray()
  blockers?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WaveActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RecordGoLiveDecisionDto {
  @IsEnum(GoLiveDecisionOption)
  decision!: GoLiveDecisionOption;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  smokeTestPassed?: boolean;

  @IsOptional()
  @IsBoolean()
  coreWorkflowsWorking?: boolean;
}

export class CreateRollbackPlanDto {
  @IsString()
  @IsNotEmpty()
  versionBeforeGoLive!: string;

  @IsOptional()
  @IsString()
  currentVersion?: string;

  @IsOptional()
  @IsString()
  rollbackTrigger?: string;

  @IsString()
  @MinLength(10)
  rollbackSteps!: string;

  @IsOptional()
  @IsString()
  databaseRestoreReference?: string;

  @IsOptional()
  @IsString()
  codeCommitReference?: string;

  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @IsOptional()
  @IsInt()
  estimatedRollbackMinutes?: number;

  @IsOptional()
  @IsEnum(RollbackTestedStatus)
  testedStatus?: RollbackTestedStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRollbackPlanDto {
  @IsOptional()
  @IsString()
  versionBeforeGoLive?: string;

  @IsOptional()
  @IsString()
  currentVersion?: string;

  @IsOptional()
  @IsString()
  rollbackTrigger?: string;

  @IsOptional()
  @IsString()
  rollbackSteps?: string;

  @IsOptional()
  @IsString()
  databaseRestoreReference?: string;

  @IsOptional()
  @IsString()
  codeCommitReference?: string;

  @IsOptional()
  @IsEnum(RollbackTestedStatus)
  testedStatus?: RollbackTestedStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateGoLiveSignOffDto {
  @IsString()
  @IsNotEmpty()
  signOffRole!: string;

  @IsEnum(GoLiveSignOffDecision)
  decision!: GoLiveSignOffDecision;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  acceptedRisks?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokeSignOffDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}

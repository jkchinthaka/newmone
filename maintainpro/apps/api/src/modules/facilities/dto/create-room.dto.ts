import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FacilityRoomType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateRoomDto {
  @ApiProperty()
  @IsString()
  floorId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @ApiPropertyOptional({ enum: FacilityRoomType })
  @IsOptional()
  @IsEnum(FacilityRoomType)
  roomType?: FacilityRoomType;
}

import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import { IsNotBlank } from "../../../common/validation/not-blank";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(36)
  roleId!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  @MinLength(1)
  roleId!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotBlank()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotBlank()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(36)
  roleId?: string;
}

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

import { BadRequestException, ValidationPipe, type ArgumentMetadata } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested } from "class-validator";

import { NotBlankStringsPipe, findBlankRequiredStrings } from "../src/common/validation/not-blank";
import { CreatePropertyDto } from "../src/modules/facilities/dto/create-property.dto";
import { UpdatePropertyDto } from "../src/modules/facilities/dto/update-property.dto";
import { UpdateProfileSettingsDto } from "../src/modules/settings/dto/update-profile-settings.dto";
import { CreateUserDto, UpdateUserDto } from "../src/modules/users/dto/users.dto";

/**
 * QA whitespace defect: required strings that contain only spaces were accepted and then
 * stored as "" (property name, profile first name). Mirrors main.ts global pipes.
 */
const validation = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
const notBlank = new NotBlankStringsPipe();

async function run(metatype: ArgumentMetadata["metatype"], body: unknown) {
  const meta: ArgumentMetadata = { type: "body", metatype, data: "" };
  const transformed = await validation.transform(body, meta);
  return notBlank.transform(transformed, meta);
}

class LineDto {
  @IsString()
  description!: string;
}

class WithLinesDto {
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[];

  @IsOptional()
  @IsString()
  note?: string;
}

describe("Required strings must satisfy trim(value).length > 0", () => {
  it("rejects a whitespace-only property name on create", async () => {
    await expect(run(CreatePropertyDto, { name: "   ", code: "QA-01" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a whitespace-only property name on update (provided but blank)", async () => {
    await expect(run(UpdatePropertyDto, { name: "  " })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a whitespace-only profile first name", async () => {
    await expect(run(UpdateProfileSettingsDto, { firstName: " " })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects whitespace-only required user names", async () => {
    await expect(
      run(CreateUserDto, { email: "qa@example.com", password: "Password123!", firstName: " ", lastName: "QA", roleId: "role-1" })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(UpdateUserDto, { lastName: "   " })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects blank strings inside nested DTO arrays", async () => {
    await expect(run(WithLinesDto, { lines: [{ description: "ok" }, { description: "  " }] })).rejects.toBeInstanceOf(
      BadRequestException
    );
    const instance = Object.assign(new WithLinesDto(), { lines: [Object.assign(new LineDto(), { description: " " })] });
    expect(findBlankRequiredStrings(instance)).toEqual(["lines[0].description"]);
  });

  it("still accepts valid values, omitted optional fields, and blank optional free text", async () => {
    await expect(run(CreatePropertyDto, { name: "Main Plant", code: "MP-01" })).resolves.toMatchObject({ name: "Main Plant" });
    await expect(run(UpdatePropertyDto, { address: " " })).resolves.toBeDefined();
    await expect(run(UpdateProfileSettingsDto, { phone: "", currentPassword: "", newPassword: "" })).resolves.toBeDefined();
    await expect(run(WithLinesDto, { lines: [{ description: "Replace bearing" }], note: " " })).resolves.toBeDefined();
  });

  it("reports the blank field name in the error", async () => {
    try {
      await run(UpdateProfileSettingsDto, { firstName: "   " });
      throw new Error("expected rejection");
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as { message: string[] };
      expect(response.message.join(" ")).toMatch(/First name is required|firstName must not be blank/);
    }
  });
});

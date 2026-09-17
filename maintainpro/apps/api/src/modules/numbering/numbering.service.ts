import { Injectable } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async next(actor: Actor, code: string, prefixOverride?: string): Promise<string> {
    const tenantId = requireTenantId(actor.tenantId);
    const codeNorm = code.trim().toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      let seq = await tx.numberingSequence.findUnique({
        where: { tenantId_code: { tenantId, code: codeNorm } }
      });
      if (!seq) {
        seq = await tx.numberingSequence.create({
          data: {
            tenantId,
            code: codeNorm,
            prefix: prefixOverride ?? `${codeNorm}-`,
            padLength: 6,
            nextValue: 1
          }
        });
      }

      const value = seq.nextValue;
      await tx.numberingSequence.update({
        where: { id: seq.id },
        data: { nextValue: value + 1 }
      });

      const prefix = prefixOverride ?? seq.prefix;
      return `${prefix}${String(value).padStart(seq.padLength, "0")}`;
    });
  }
}

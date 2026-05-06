import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { withValidation } from "@/lib/api/with-validation";
import { registerSchema } from "@/lib/schemas/auth";
import { withRateLimit } from "@/lib/rate-limit";

const handler = withValidation({ body: registerSchema })(
  async (_req: NextRequest, { body }) => {
    try {
      const { email, password, contactName, companyName, rfc, industry, phone, track } = body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con ese correo electrónico" },
          { status: 409 }
        );
      }

      const hashed = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          name: contactName,
          password: hashed,
          role: "COMPANY",
          companyName,
          rfc: rfc || null,
          industry: industry || null,
          phone: phone || null,
          track: track || null,
        },
      });

      return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
    } catch (err) {
      console.error("Register error:", err);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
  }
);

export const POST = withRateLimit(
  { points: 5, duration: 60, keyPrefix: "rl:register" },
  handler as any
);

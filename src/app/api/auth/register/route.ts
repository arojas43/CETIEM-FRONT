import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, contactName, companyName, rfc, industry, phone, track } = body;

    if (!email || !password || !contactName || !companyName) {
      return NextResponse.json(
        { error: "Campos obligatorios: email, password, contactName, companyName" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

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
        track: (track && ["A","B","C"].includes(track)) ? track : null,
      },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

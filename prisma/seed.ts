import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("cetiem2024", 10);

  const users = [
    {
      email: "admin@cetiem.mx",
      name: "Super Admin",
      password,
      role: UserRole.ADMIN,
      companyName: null,
    },
    {
      email: "assessor@cetiem.mx",
      name: "Assessor Principal",
      password,
      role: UserRole.ASSESSOR,
      companyName: null,
    },
    {
      email: "empresa1@cetiem.mx",
      name: "Empresa Demo S.A. de C.V.",
      password,
      role: UserRole.COMPANY,
      companyName: "Empresa Demo S.A. de C.V.",
      rfc: "EDE123456ABC",
      industry: "Manufactura",
      phone: "+52 55 1234 5678",
    },
    {
      email: "empresa2@cetiem.mx",
      name: "Industrias Beta S.A.",
      password,
      role: UserRole.COMPANY,
      companyName: "Industrias Beta S.A.",
      rfc: "IBS987654XYZ",
      industry: "Tecnología",
      phone: "+52 55 9876 5432",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
    console.log(`  ✓ ${user.role}: ${user.email}`);
  }

  console.log("\nDone! Credentials (all use password: cetiem2024):");
  console.log("  admin@cetiem.mx      → ADMIN");
  console.log("  assessor@cetiem.mx   → ASSESSOR");
  console.log("  empresa1@cetiem.mx   → COMPANY");
  console.log("  empresa2@cetiem.mx   → COMPANY");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

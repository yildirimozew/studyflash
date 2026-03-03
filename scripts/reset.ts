import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter }) as unknown as PrismaClient;

async function main() {
  console.log("Deleting all data...");

  // Order matters: delete children before parents
  await prisma.comment.deleteMany();
  console.log("  ✓ Comments deleted");

  await prisma.message.deleteMany();
  console.log("  ✓ Messages deleted");

  await prisma.ticket.deleteMany();
  console.log("  ✓ Tickets deleted");

  await prisma.user.deleteMany();
  console.log("  ✓ Users deleted");

  console.log("\nDatabase reset complete. Run `npm run seed` to re-populate.");
}

main()
  .catch((e) => {
    console.error("Reset failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

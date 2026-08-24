import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeProductUnit } from "../src/lib/catalog/unit-normalizer.ts";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

try {
  const variants = await prisma.productVariant.findMany({
    select: { id: true, optionName: true },
    where: { optionName: { not: null } },
  });
  let updated = 0;

  for (const variant of variants) {
    const unit = normalizeProductUnit(variant.optionName ?? "");
    if (!unit) continue;

    await prisma.productVariant.update({
      data: unit,
      where: { id: variant.id },
    });
    updated += 1;
  }

  console.log(JSON.stringify({ scanned: variants.length, updated }, null, 2));
} finally {
  await prisma.$disconnect();
}


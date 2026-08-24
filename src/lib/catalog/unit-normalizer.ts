export type NormalizedProductUnit = {
  packCount: number;
  unitLabel: "g" | "ml" | "개" | "매" | "정" | "캡슐" | "포" | "롤";
  unitQuantity: number;
};

type UnitMatch = {
  end: number;
  index: number;
  label: NormalizedProductUnit["unitLabel"];
  quantity: number;
};

const numberPattern = String.raw`(\d[\d,]*(?:\.\d+)?)`;

function parseNumber(value: string) {
  return Number(value.replaceAll(",", ""));
}

function findUnitMatch(title: string): UnitMatch | null {
  const semanticPatterns: Array<{
    label: UnitMatch["label"];
    multiplier?: number;
    pattern: RegExp;
  }> = [
    { label: "매", pattern: new RegExp(`${numberPattern}\\s*(?:매입|매)(?![가-힣])`, "i") },
    { label: "정", pattern: new RegExp(`${numberPattern}\\s*정(?![가-힣])`, "i") },
    { label: "캡슐", pattern: new RegExp(`${numberPattern}\\s*캡슐(?![가-힣])`, "i") },
    { label: "포", pattern: new RegExp(`${numberPattern}\\s*포(?![가-힣])`, "i") },
    { label: "롤", pattern: new RegExp(`${numberPattern}\\s*롤(?![가-힣])`, "i") },
  ];
  const physicalPatterns: Array<{
    label: "g" | "ml";
    multiplier?: number;
    pattern: RegExp;
  }> = [
    { label: "ml", pattern: new RegExp(`${numberPattern}\\s*(?:ml|㎖)(?![a-z])`, "i") },
    { label: "ml", multiplier: 1_000, pattern: new RegExp(`${numberPattern}\\s*(?:l|ℓ)(?![a-z])`, "i") },
    { label: "g", multiplier: 1_000, pattern: new RegExp(`${numberPattern}\\s*kg(?![a-z])`, "i") },
    { label: "g", pattern: new RegExp(`${numberPattern}\\s*g(?![a-z])`, "i") },
  ];

  function findMatch(patterns: Array<{ label: UnitMatch["label"]; multiplier?: number; pattern: RegExp }>) {
    for (const { label, multiplier = 1, pattern } of patterns) {
      const match = pattern.exec(title);
      const quantity = match ? parseNumber(match[1]) * multiplier : 0;

      if (match?.index !== undefined && Number.isFinite(quantity) && quantity > 0) {
        return {
          end: match.index + match[0].length,
          index: match.index,
          label,
          quantity,
        };
      }
    }

    return null;
  }

  const semanticMatch = findMatch(semanticPatterns);
  if (semanticMatch) return semanticMatch;

  const physicalMatch = findMatch(physicalPatterns);
  const countPattern = new RegExp(`${numberPattern}\\s*개입(?![가-힣])`, "i");
  const countRaw = countPattern.exec(title);
  const countQuantity = countRaw ? parseNumber(countRaw[1]) : 0;
  const countMatch = countRaw?.index !== undefined && countQuantity > 0
    ? {
        end: countRaw.index + countRaw[0].length,
        index: countRaw.index,
        label: "개" as const,
        quantity: countQuantity,
      }
    : null;

  if (physicalMatch && (!countMatch || countMatch.quantity <= 1 || physicalMatch.quantity >= 100)) {
    return physicalMatch;
  }

  return countMatch ?? physicalMatch;
}

function findPackCount(title: string, unitMatch: UnitMatch) {
  const pattern = new RegExp(
    `${numberPattern}\\s*(?:개입|개|팩|박스|묶음|세트)(?![가-힣])`,
    "gi",
  );
  const matches = [...title.matchAll(pattern)].filter((match) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    return end <= unitMatch.index || start >= unitMatch.end;
  });
  const packCount = matches.reduce(
    (largest, match) => Math.max(largest, parseNumber(match[1])),
    1,
  );

  return Number.isSafeInteger(packCount) && packCount > 0 && packCount <= 10_000
    ? packCount
    : 1;
}

export function normalizeProductUnit(title: string): NormalizedProductUnit | null {
  const unitMatch = findUnitMatch(title.normalize("NFKC"));

  if (!unitMatch) return null;

  const packCount = findPackCount(title.normalize("NFKC"), unitMatch);
  const unitQuantity = Math.round(unitMatch.quantity * packCount * 1_000) / 1_000;

  if (!Number.isFinite(unitQuantity) || unitQuantity <= 0 || unitQuantity > 999_999_999) {
    return null;
  }

  return {
    packCount,
    unitLabel: unitMatch.label,
    unitQuantity,
  };
}

import "server-only";

export function isPlaceholderLegalValue(value = "") {
  return /your-domain|replace-with|change_this|example\.com|example\.org/i.test(
    value,
  );
}

export function getLegalConfig() {
  return {
    contactEmail:
      process.env.FAIRPRICE_CONTACT_EMAIL?.trim() || "contact@example.com",
    operatorName:
      process.env.FAIRPRICE_OPERATOR_NAME?.trim() || "Fairprice 운영자",
  };
}

export function isLegalConfigReady() {
  const contactEmail = process.env.FAIRPRICE_CONTACT_EMAIL?.trim();
  const operatorName = process.env.FAIRPRICE_OPERATOR_NAME?.trim();

  return getLegalReadiness({ contactEmail, operatorName }).ready;
}

export function getLegalReadiness(
  values: {
    contactEmail?: string;
    operatorName?: string;
  } = {},
) {
  const contactEmail =
    values.contactEmail ?? process.env.FAIRPRICE_CONTACT_EMAIL?.trim();
  const operatorName =
    values.operatorName ?? process.env.FAIRPRICE_OPERATOR_NAME?.trim();
  const contactEmailReady = Boolean(
    contactEmail &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) &&
      !isPlaceholderLegalValue(contactEmail),
  );
  const operatorNameReady = Boolean(
      operatorName &&
      !isPlaceholderLegalValue(operatorName),
  );

  return {
    contactEmailReady,
    operatorNameReady,
    ready: contactEmailReady && operatorNameReady,
  };
}

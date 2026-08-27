export const DEFAULT_ALERT_COOLDOWN_HOURS = 24;

export type AlertDeliveryDecision = "cooldown" | "duplicate" | "notify";

export function getAlertCooldownHours(value = process.env.ALERT_COOLDOWN_HOURS) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 168
    ? Math.floor(parsed)
    : DEFAULT_ALERT_COOLDOWN_HOURS;
}

export function getAlertDeliveryDecision({
  cooldownHours,
  lastTriggeredAt,
  now,
  wasConditionMet,
}: {
  cooldownHours: number;
  lastTriggeredAt?: Date | null;
  now: Date;
  wasConditionMet: boolean;
}): AlertDeliveryDecision {
  if (wasConditionMet) return "duplicate";

  if (
    lastTriggeredAt &&
    now.getTime() - lastTriggeredAt.getTime() < cooldownHours * 60 * 60 * 1000
  ) {
    return "cooldown";
  }

  return "notify";
}

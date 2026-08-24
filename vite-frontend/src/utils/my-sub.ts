export interface TransparentRelaySubscriptionSummary {
  subToken?: string | null;
  availableCount?: number | string | null;
  skippedCount?: number | string | null;
}

export function toSafeCount(value: number | string | null | undefined): number {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : 0;
}

export function buildTransparentRelaySubUrl(origin: string, token: string): string {
  return `${origin}/api/v1/open_api/transparent_relay_sub?token=${encodeURIComponent(token)}`;
}

export function shouldShowTransparentRelaySubscription(
  subscription: TransparentRelaySubscriptionSummary | null | undefined,
): boolean {
  return !!subscription?.subToken && toSafeCount(subscription.availableCount) > 0;
}

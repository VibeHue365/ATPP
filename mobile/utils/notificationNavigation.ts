import { type Href, router } from "expo-router";
import { getCurrentPortalMode } from "@/utils/navigation";

export function openNotificationData(
  data: Record<string, unknown> = {},
  options?: { isProviderPortal?: boolean },
): boolean {
  const nested =
    typeof data.booking === "object" && data.booking !== null
      ? (data.booking as Record<string, unknown>)
      : {};
  const bookingId = String(data.bookingId ?? nested._id ?? "");
  const contractId = String(data.contractId ?? "");
  const paymentCode = String(data.paymentCode ?? data.code ?? "");
  const targetRole =
    typeof data.targetRole === "string"
      ? data.targetRole.toLowerCase()
      : null;

  const currentMode = getCurrentPortalMode();
  if (currentMode === "staff" || targetRole === "staff") {
    router.push("/staff" as Href);
    return true;
  }

  const isProviderTarget =
    targetRole === "provider" ||
    (targetRole !== "customer" &&
      (options?.isProviderPortal ?? currentMode === "provider"));

  if (isProviderTarget && bookingId) {
    router.push({
      pathname: "/provider/(tabs)/orders",
      params: { bookingId },
    } as unknown as Href);
    return true;
  }

  if (paymentCode) {
    router.push({
      pathname: "/payment/result",
      params: { code: paymentCode },
    } as unknown as Href);
    return true;
  }
  if (bookingId) {
    router.push(`/booking/${bookingId}` as Href);
    return true;
  }
  if (contractId) {
    router.push("/contracts" as Href);
    return true;
  }
  if (isProviderTarget) {
    router.push("/provider" as Href);
    return false;
  }
  router.push("/notifications" as Href);
  return false;
}

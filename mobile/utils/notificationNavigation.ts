import { type Href, router } from "expo-router";

export function openNotificationData(
  data: Record<string, unknown> = {},
): boolean {
  const nested =
    typeof data.booking === "object" && data.booking !== null
      ? (data.booking as Record<string, unknown>)
      : {};
  const bookingId = String(data.bookingId ?? nested._id ?? "");
  const contractId = String(data.contractId ?? "");
  const paymentCode = String(data.paymentCode ?? data.code ?? "");
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
  router.push("/notifications" as Href);
  return false;
}

import { router, type Href } from 'expo-router';
import { chatApi } from '@/apis/chatApi';

/**
 * Open the direct chat room between the provider and the booking's customer.
 * Falls back gracefully to `/chat` if the customer user ID is missing or room creation fails.
 */
export async function openOrderCustomerChat(order?: any | null): Promise<void> {
  const customerId =
    typeof order?.customerId === 'object'
      ? order?.customerId?._id || order?.customerId?.id
      : order?.customerId;
  const customerName =
    order?.customerId?.profile?.fullName ||
    order?.contactInfo?.fullName ||
    'Khách hàng TàGo';

  if (!customerId || typeof customerId !== 'string') {
    router.push('/chat' as Href);
    return;
  }

  try {
    const room = await chatApi.createRoom(customerId);
    if (room?.id) {
      router.push({
        pathname: '/chat/[id]',
        params: { id: room.id, name: customerName },
      } as unknown as Href);
      return;
    }
  } catch {
    // Fall back to the inbox list when direct room lookup/creation fails
  }

  router.push('/chat' as Href);
}

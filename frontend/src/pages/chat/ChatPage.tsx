import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../features/auth/hooks/useAuth';
import {
  RoleChatWorkspace,
  type RoleChatMode,
} from '../../features/chat/RoleChatWorkspace';

interface ChatPageProps {
  embedded?: boolean;
  mode?: RoleChatMode;
  onUnreadCountChange?: (count: number) => void;
  excludeProviderId?: string;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  embedded = false,
  mode,
  onUnreadCountChange,
  excludeProviderId,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const normalizedRoles = (user?.roles || []).map((r) => String(r).toUpperCase());
  const isStaffOnly =
    normalizedRoles.includes('STAFF') &&
    !normalizedRoles.includes('PROVIDER') &&
    !normalizedRoles.includes('ADMIN');

  const resolvedMode: RoleChatMode =
    mode ??
    (isStaffOnly
      ? 'staff'
      : normalizedRoles.includes('PROVIDER')
        ? 'provider'
        : 'customer');

  const stateActiveRoomId =
    (location.state as { activeRoomId?: string } | null)?.activeRoomId ?? null;

  useEffect(() => {
    // Isolated STAFF accounts should never view chat inside Customer MainLayout chrome
    if (!embedded && isStaffOnly) {
      const params = new URLSearchParams();
      params.set('tab', 'chat');
      if (stateActiveRoomId) params.set('roomId', stateActiveRoomId);
      navigate(`${ROUTES.STAFF_PORTAL}?${params.toString()}`, { replace: true });
    }
  }, [embedded, isStaffOnly, navigate, stateActiveRoomId]);

  if (!embedded && isStaffOnly) {
    return null;
  }

  return (
    <div style={embedded ? undefined : { padding: '20px 24px 32px' }}>
      <RoleChatWorkspace
        mode={resolvedMode}
        embedded={embedded}
        initialRoomId={stateActiveRoomId}
        excludeProviderId={excludeProviderId}
        onUnreadCountChange={onUnreadCountChange}
      />
    </div>
  );
};

export default ChatPage;

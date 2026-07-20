import { useCallback, useRef, useState } from 'react';
import { adminVerificationApi } from '../api/adminVerificationApi';
import type {
  AdminReviewDecisionPayload,
  AdminVerificationDetail,
  AdminVerificationSummary,
} from '../types';
import type { ProviderDocumentType } from '../../provider-verifications/types';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';

export type AdminVerificationActionResult =
  | { ok: true }
  | { ok: false; message: string };

export function useAdminVerifications() {
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const [items, setItems] = useState<AdminVerificationSummary[]>([]);
  const [selected, setSelected] = useState<AdminVerificationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const requestId = ++listRequestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const nextItems = await adminVerificationApi.list();
      if (requestId === listRequestId.current) setItems(nextItems);
    } catch (requestError) {
      if (requestId === listRequestId.current) setError(getErrorMessage(requestError));
    } finally {
      if (requestId === listRequestId.current) setIsLoading(false);
    }
  }, []);

  const open = useCallback(async (verificationId: string) => {
    const requestId = ++detailRequestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const detail = await adminVerificationApi.detail(verificationId);
      if (requestId === detailRequestId.current) setSelected(detail);
    } catch (requestError) {
      if (requestId === detailRequestId.current) setError(getErrorMessage(requestError));
    } finally {
      if (requestId === detailRequestId.current) setIsLoading(false);
    }
  }, []);

  const runAction = useCallback(async (
    verificationId: string,
    action: () => Promise<void>,
  ): Promise<AdminVerificationActionResult> => {
    setIsSaving(true);
    setError(null);

    try {
      await action();
      await refresh();
      await open(verificationId);
      return { ok: true };
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setError(message);
      return { ok: false, message };
    } finally {
      setIsSaving(false);
    }
  }, [open, refresh]);

  return {
    error,
    isLoading,
    isSaving,
    items,
    open,
    refresh,
    selected,
    setSelected,
    startReview: (id: string) =>
      runAction(id, () => adminVerificationApi.startReview(id)),
    approve: (id: string, payload: AdminReviewDecisionPayload) =>
      runAction(id, () => adminVerificationApi.approve(id, payload)),
    reject: (id: string, payload: AdminReviewDecisionPayload) =>
      runAction(id, () => adminVerificationApi.reject(id, payload)),
    requestChanges: (id: string, payload: AdminReviewDecisionPayload) =>
      runAction(id, () => adminVerificationApi.requestChanges(id, payload)),
    runOcr: (id: string, type: ProviderDocumentType) =>
      runAction(id, () => adminVerificationApi.runOcr(id, type)),
  };
}
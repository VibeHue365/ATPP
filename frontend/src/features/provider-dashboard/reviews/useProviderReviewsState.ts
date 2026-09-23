
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderReviewsState() {
  const [reviewsData, setReviewsData] = useState<any>(null);
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  return {
    reviewsData, setReviewsData, replyingReviewId, setReplyingReviewId, replyText, setReplyText,
  };
}


import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderTrustState() {
  const [bookingsState, setBookingsState] = useState<any[]>([]);
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [cRating, setCRating] = useState(5);
  const [cComment, setCComment] = useState('');
  const [searchCustId, setSearchCustId] = useState('');
  const [trustScoreResult, setTrustScoreResult] = useState<any>(null);

  return {
    bookingsState, setBookingsState, ratingBooking, setRatingBooking, cRating, setCRating, cComment,
    setCComment, searchCustId, setSearchCustId, trustScoreResult, setTrustScoreResult,
  };
}

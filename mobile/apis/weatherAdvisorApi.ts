import httpClient from '@/apis/httpClient';
import type {
  HeritageSpot,
  SpotAssessmentResponse,
  WeatherProposal,
  WeatherCancellationRequest,
} from '@/types/weather';

export const weatherAdvisorApi = {
  /**
   * 7-day weather forecast in Hue with shoot scores
   */
  getForecast: (params?: { lat?: number; lng?: number; date?: string; spaceType?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.lat !== undefined) searchParams.append('lat', params.lat.toString());
    if (params?.lng !== undefined) searchParams.append('lng', params.lng.toString());
    if (params?.date) searchParams.append('date', params.date);
    if (params?.spaceType) searchParams.append('spaceType', params.spaceType);
    const qs = searchParams.toString();
    return httpClient.get<never, any>(`/weather-advisor/forecast${qs ? `?${qs}` : ''}`);
  },

  /**
   * Assess a specific photoshoot time slot at a heritage spot
   */
  assessSpotSlot: (spotId: string, params: { date: string; timeSlot: string }) => {
    return httpClient.get<never, SpotAssessmentResponse>(
      `/weather-advisor/spots/${spotId}/assessment?date=${encodeURIComponent(params.date)}&timeSlot=${encodeURIComponent(params.timeSlot)}`,
    );
  },

  /**
   * List heritage spots with optional geospatial and space type filter
   */
  listSpots: (params?: { spaceType?: string; lat?: number; lng?: number; radiusKm?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.spaceType) searchParams.append('spaceType', params.spaceType);
    if (params?.lat !== undefined) searchParams.append('lat', params.lat.toString());
    if (params?.lng !== undefined) searchParams.append('lng', params.lng.toString());
    if (params?.radiusKm !== undefined) searchParams.append('radiusKm', params.radiusKm.toString());
    const qs = searchParams.toString();
    return httpClient.get<never, HeritageSpot[]>(`/heritage-spots${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get single heritage spot details
   */
  getSpot: (id: string) => {
    return httpClient.get<never, HeritageSpot>(`/heritage-spots/${id}`);
  },

  /**
   * Submit Plan B proposal for a booking (AD-01, AD-02)
   */
  createProposal: (
    bookingId: string,
    payload: {
      changeType: 'LOCATION_ONLY' | 'DATE_AND_SLOT' | 'SLOT_ONLY';
      proposedSpotId?: string;
      proposedDate?: string;
      proposedTimeSlot?: string;
    },
  ) => {
    return httpClient.post<never, WeatherProposal>(
      `/weather-proposals/bookings/${bookingId}`,
      payload,
    );
  },

  /**
   * List proposals for a booking
   */
  listProposals: (bookingId: string) => {
    return httpClient.get<never, WeatherProposal[]>(
      `/weather-proposals/bookings/${bookingId}`,
    );
  },

  /**
   * Customer cancels pending proposal
   */
  cancelProposal: (proposalId: string) => {
    return httpClient.post<never, WeatherProposal>(
      `/weather-proposals/${proposalId}/cancel`,
      {},
    );
  },

  /**
   * Submit weather cancellation request (AD-03)
   */
  submitCancellation: (
    bookingId: string,
    payload: {
      reason: string;
      evidencePhotos?: string[];
    },
  ) => {
    return httpClient.post<never, WeatherCancellationRequest>(
      `/weather-cancellations/bookings/${bookingId}`,
      payload,
    );
  },

  /**
   * Get weather cancellation request for a booking
   */
  getBookingCancellation: (bookingId: string) => {
    return httpClient.get<never, WeatherCancellationRequest | null>(
      `/weather-cancellations/bookings/${bookingId}`,
    );
  },
};


import { useState } from 'react';
import type { Order } from '../types';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderIncidentState() {
  const [reportingOrder, setReportingOrder] = useState<Order | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [incidentDesc, setIncidentDesc] = useState<string>('');
  const [incidentPhotos, setIncidentPhotos] = useState<string[]>([]);
  const [incidentAmount, setIncidentAmount] = useState<number>(0);
  const [incidentActionType, setIncidentActionType] = useState<'CLEANING' | 'MAINTENANCE' | 'NO_SHOW' | 'VIOLATION'>('CLEANING');

  return {
    reportingOrder, setReportingOrder, selectedItemId, setSelectedItemId, incidentDesc, setIncidentDesc,
    incidentPhotos, setIncidentPhotos, incidentAmount, setIncidentAmount, incidentActionType,
    setIncidentActionType,
  };
}

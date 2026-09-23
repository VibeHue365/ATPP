
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderCampaignState() {
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [campaignOccasion, setCampaignOccasion] = useState('');
  const [campaignPercent, setCampaignPercent] = useState('10');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [submittingCampaign, setSubmittingCampaign] = useState(false);

  return {
    isCampaignModalOpen, setIsCampaignModalOpen, campaignOccasion, setCampaignOccasion, campaignPercent,
    setCampaignPercent, campaignStart, setCampaignStart, campaignEnd, setCampaignEnd, activeCampaign,
    setActiveCampaign, submittingCampaign, setSubmittingCampaign,
  };
}

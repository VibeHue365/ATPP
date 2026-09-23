
import { useState } from 'react';
import type { Product, VariantRow } from '../types';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProductWizardState() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodBasePrice, setProdBasePrice] = useState('');
  const [prodDepositAmount, setProdDepositAmount] = useState('');
  const [prodSizes, setProdSizes] = useState<string[]>([]);
  const [prodColors, setProdColors] = useState<string[]>([]);
  const [prodMaterials, setProdMaterials] = useState<string[]>([]);
  const [prodStatus, setProdStatus] = useState<'ACTIVE' | 'DRAFT' | 'INACTIVE'>('DRAFT');
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [prodColorImages, setProdColorImages] = useState<Record<string, string[]>>({});
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [prodVideos, setProdVideos] = useState<string[]>([]);
  const [uploadingVideos, setUploadingVideos] = useState(false);
  const [prodStyle, setProdStyle] = useState('traditional');
  const [prodOccasions, setProdOccasions] = useState<string[]>([]);
  const [prodStyleCategoryIds, setProdStyleCategoryIds] = useState<string[]>([]);
  const [prodEventCategoryIds, setProdEventCategoryIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [activeTagCodes, setActiveTagCodes] = useState<string[]>([]);
  const [editInvSummary, setEditInvSummary] = useState<any[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);

  return {
    isModalOpen, setIsModalOpen, editingProduct, setEditingProduct, prodName, setProdName, prodCategoryId,
    setProdCategoryId, prodDescription, setProdDescription, prodBasePrice, setProdBasePrice,
    prodDepositAmount, setProdDepositAmount, prodSizes, setProdSizes, prodColors, setProdColors,
    prodMaterials, setProdMaterials, prodStatus, setProdStatus, prodImages, setProdImages,
    prodColorImages, setProdColorImages, uploadingColor, setUploadingColor, uploadingImages,
    setUploadingImages, prodVideos, setProdVideos, uploadingVideos, setUploadingVideos, prodStyle,
    setProdStyle, prodOccasions, setProdOccasions, prodStyleCategoryIds, setProdStyleCategoryIds,
    prodEventCategoryIds, setProdEventCategoryIds, variants, setVariants, wizardStep, setWizardStep,
    createdDraftId, setCreatedDraftId, activeTagCodes, setActiveTagCodes, editInvSummary,
    setEditInvSummary, savingDraft, setSavingDraft,
  };
}

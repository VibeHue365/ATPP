
import { useState } from 'react';
import type { PortfolioItem } from '../types';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderPortfolioState() {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [isPortfolioFormOpen, setIsPortfolioFormOpen] = useState(false);
  const [isPortfolioSaving, setIsPortfolioSaving] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [editingPortfolioItem, setEditingPortfolioItem] = useState<PortfolioItem | null>(null);
  const [previewPortfolioItem, setPreviewPortfolioItem] = useState<PortfolioItem | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);

  return {
    portfolioItems, setPortfolioItems, isPortfolioFormOpen, setIsPortfolioFormOpen, isPortfolioSaving,
    setIsPortfolioSaving, hoveredItemId, setHoveredItemId, editingPortfolioItem, setEditingPortfolioItem,
    previewPortfolioItem, setPreviewPortfolioItem, previewImageIndex, setPreviewImageIndex,
  };
}

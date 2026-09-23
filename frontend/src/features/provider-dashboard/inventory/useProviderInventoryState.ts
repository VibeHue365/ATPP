
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderInventoryState() {
  const [invSearch, setInvSearch] = useState('');
  const [invSortBy, setInvSortBy] = useState('newest');
  const [invStatusFilter, setInvStatusFilter] = useState('');
  const [invConditionFilter, setInvConditionFilter] = useState('');
  const [invPage, setInvPage] = useState(1);
  const [invSummaryPage, setInvSummaryPage] = useState(1);
  const [invLimit] = useState(10);
  const [invTotal, setInvTotal] = useState(0);
  const [debouncedInvSearch, setDebouncedInvSearch] = useState('');
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventorySummary, setInventorySummary] = useState<any[]>([]);
  const [myProductsList, setMyProductsList] = useState<any[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [variantEditRow, setVariantEditRow] = useState<any | null>(null);
  const [variantEditQty, setVariantEditQty] = useState<string>('1');
  const [variantBusy, setVariantBusy] = useState(false);
  const [isAddInventoryOpen, setIsAddInventoryOpen] = useState(false);
  const [addInvProductId, setAddInvProductId] = useState('');
  const [addInvSize, setAddInvSize] = useState('M');
  const [addInvColor, setAddInvColor] = useState('WHITE');
  const [addInvMaterial, setAddInvMaterial] = useState('');
  const [addInvQuantity, setAddInvQuantity] = useState(1);
  const [addInvCondition, setAddInvCondition] = useState('GOOD');
  const [addInvNotes, setAddInvNotes] = useState('');
  const [isEditInventoryOpen, setIsEditInventoryOpen] = useState(false);
  const [editInvItem, setEditInvItem] = useState<any>(null);
  const [editInvStatus, setEditInvStatus] = useState('AVAILABLE');
  const [editInvCondition, setEditInvCondition] = useState('GOOD');
  const [editInvNotes, setEditInvNotes] = useState('');

  return {
    invSearch, setInvSearch, invSortBy, setInvSortBy, invStatusFilter, setInvStatusFilter,
    invConditionFilter, setInvConditionFilter, invPage, setInvPage, invSummaryPage, setInvSummaryPage,
    invLimit, invTotal, setInvTotal, debouncedInvSearch, setDebouncedInvSearch, inventoryItems,
    setInventoryItems, inventorySummary, setInventorySummary, myProductsList, setMyProductsList,
    isLoadingInventory, setIsLoadingInventory, variantEditRow, setVariantEditRow, variantEditQty,
    setVariantEditQty, variantBusy, setVariantBusy, isAddInventoryOpen, setIsAddInventoryOpen,
    addInvProductId, setAddInvProductId, addInvSize, setAddInvSize, addInvColor, setAddInvColor,
    addInvMaterial, setAddInvMaterial, addInvQuantity, setAddInvQuantity, addInvCondition,
    setAddInvCondition, addInvNotes, setAddInvNotes, isEditInventoryOpen, setIsEditInventoryOpen,
    editInvItem, setEditInvItem, editInvStatus, setEditInvStatus, editInvCondition, setEditInvCondition,
    editInvNotes, setEditInvNotes,
  };
}

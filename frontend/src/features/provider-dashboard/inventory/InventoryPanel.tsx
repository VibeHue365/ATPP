import { useState } from 'react';
import { InventoryItemGroups } from './InventoryItemGroups';
import { InventorySummaryTable } from './InventorySummaryTable';
import type { InventoryItem } from './inventoryGrouping';
import type { useProviderInventoryState } from './useProviderInventoryState';
import './inventoryItemGroups.css';

type InventoryPanelProps = Pick<ReturnType<typeof useProviderInventoryState>,
  'inventorySummary' | 'invSummaryPage' | 'invSearch' | 'setInvSearch' | 'invStatusFilter' | 'setInvStatusFilter' | 'invConditionFilter' | 'setInvConditionFilter' | 'invSortBy' | 'setInvSortBy' | 'isLoadingInventory' | 'variantBusy' | 'setVariantEditRow' | 'setVariantEditQty' | 'setInvSummaryPage' | 'inventoryItems' | 'setEditInvItem' | 'setEditInvStatus' | 'setEditInvCondition' | 'setEditInvNotes' | 'setIsEditInventoryOpen' | 'invTotal' | 'invLimit' | 'invPage' | 'setInvPage'
> &
{
  handleRemoveVariant: (row: any) => Promise<void>;
  handleDeleteInventoryItem: (itemId: string) => Promise<void>;
  handleQuickUpdateStatus?: (itemId: string, newStatus: string, currentCondition?: string, currentNotes?: string) => Promise<void>;
  handleBulkMarkAvailable?: (items: InventoryItem[]) => Promise<void>;
};

type InventorySubTab = 'summary' | 'items';

const SUB_TABS: Array<{ key: InventorySubTab; label: string }> = [
  { key: 'summary', label: 'Tất cả sản phẩm' },
  { key: 'items', label: 'Sản phẩm chi tiết' },
];

export function InventoryPanel({
  inventorySummary, invSummaryPage, invSearch, setInvSearch, invStatusFilter, setInvStatusFilter,
  invConditionFilter, setInvConditionFilter, invSortBy, setInvSortBy, isLoadingInventory, variantBusy,
  setVariantEditRow, setVariantEditQty, handleRemoveVariant, setInvSummaryPage, inventoryItems,
  setEditInvItem, setEditInvStatus, setEditInvCondition, setEditInvNotes, setIsEditInventoryOpen,
  handleDeleteInventoryItem, handleQuickUpdateStatus, handleBulkMarkAvailable, invTotal, invPage, setInvPage,
}: InventoryPanelProps) {
  const [subTab, setSubTab] = useState<InventorySubTab>('summary');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="inv-subtabs" role="tablist" aria-label="Chế độ xem tồn kho">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={subTab === tab.key}
            className={`inv-subtab${subTab === tab.key ? ' is-active' : ''}`}
            onClick={() => setSubTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoadingInventory ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          Đang tải dữ liệu kho áo dài...
        </div>
      ) : subTab === 'summary' ? (
        <InventorySummaryTable
          {...{ inventorySummary, invSummaryPage, setInvSummaryPage, variantBusy, setVariantEditRow, setVariantEditQty, handleRemoveVariant }}
        />
      ) : (
        <InventoryItemGroups
          {...{
            inventoryItems, invTotal, invSearch, setInvSearch, invStatusFilter, setInvStatusFilter,
            invConditionFilter, setInvConditionFilter, invSortBy, setInvSortBy, invPage, setInvPage,
            variantBusy, setEditInvItem, setEditInvStatus, setEditInvCondition, setEditInvNotes, setIsEditInventoryOpen,
            handleDeleteInventoryItem, handleQuickUpdateStatus, handleBulkMarkAvailable,
          }}
        />
      )}
    </div>
  );
}

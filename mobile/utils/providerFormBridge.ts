import type { StoreHubTab } from '@/components/provider/store/StoreManagementHubModal';

interface PendingProductFormState {
  editingProduct: any | null;
  onSaved?: () => void;
}

interface PendingPkgComboFormState {
  mode: 'PACKAGE' | 'COMBO';
  editingItem: any | null;
  products: any[];
  packages: any[];
  onSaved?: () => void;
}

interface PendingStoreHubState {
  initialTab: StoreHubTab;
  profile: any | null;
  onUpdated?: () => void;
}

let pendingProductForm: PendingProductFormState = { editingProduct: null };
let pendingPkgComboForm: PendingPkgComboFormState = {
  mode: 'PACKAGE',
  editingItem: null,
  products: [],
  packages: [],
};
let pendingStoreHub: PendingStoreHubState = {
  initialTab: 'SETTINGS',
  profile: null,
};

export function setPendingProductFormState(next: PendingProductFormState) {
  pendingProductForm = next;
}

export function getPendingProductFormState(): PendingProductFormState {
  return pendingProductForm;
}

export function setPendingPkgComboFormState(next: PendingPkgComboFormState) {
  pendingPkgComboForm = next;
}

export function getPendingPkgComboFormState(): PendingPkgComboFormState {
  return pendingPkgComboForm;
}

export function setPendingStoreHubState(next: PendingStoreHubState) {
  pendingStoreHub = next;
}

export function getPendingStoreHubState(): PendingStoreHubState {
  return pendingStoreHub;
}

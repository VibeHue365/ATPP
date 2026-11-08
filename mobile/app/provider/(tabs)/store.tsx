import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/contexts/NotificationContext';
import type {
  ProviderProfile,
  ProviderPerformance,
  InventorySummaryItem,
} from '@/types/provider';

import { StoreProfileHeaderCard } from '@/components/provider/store/StoreProfileHeaderCard';
import {
  InventoryBreakdownCard,
  type InventoryViewTab,
} from '@/components/provider/store/InventoryBreakdownCard';
import {
  InventoryFilterSection,
  type StockStatusFilter,
  type CollectionChip,
  type SizeChip,
} from '@/components/provider/store/InventoryFilterSection';
import {
  InventoryProductMatrixCard,
  type EnrichedInventoryProduct,
  type SizeStockCell,
} from '@/components/provider/store/InventoryProductMatrixCard';
import { RfidChipDetailModal } from '@/components/provider/store/RfidChipDetailModal';
import { AddProductModal } from '@/components/provider/store/AddProductModal';
import {
  StoreManagementHubModal,
  type StoreHubTab,
} from '@/components/provider/store/StoreManagementHubModal';
import { PhotographyPackageItemCard } from '@/components/provider/store/PhotographyPackageItemCard';
import { ComboPromotionItemCard } from '@/components/provider/store/ComboPromotionItemCard';
import {
  PackageAndComboFormModal,
  type PackageComboModalMode,
} from '@/components/provider/store/PackageAndComboFormModal';

type StoreMainCategoryTab = 'AODAI' | 'PHOTOGRAPHY' | 'COMBO';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80',
];

function resolveImageUrl(rawUrl?: string | null, index = 0): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
  }
  const baseApi = (
    process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000'
  ).replace(/\/$/, '');
  if (rawUrl.startsWith('/')) {
    return `${baseApi}${rawUrl}`;
  }
  if (rawUrl.includes('localhost:3000') || rawUrl.includes('127.0.0.1:3000')) {
    return rawUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1):3000/, baseApi);
  }
  return rawUrl;
}

function getColorMeta(colorRaw?: string): { label: string; hex: string } {
  const c = (colorRaw || '').trim();
  const lower = c.toLowerCase();
  if (lower.includes('đỏ') || lower.includes('red') || lower.includes('crimson')) {
    return { label: c || 'Đỏ Chu Sa', hex: '#CA4A48' };
  }
  if (lower.includes('vàng') || lower.includes('yellow') || lower.includes('gold')) {
    return { label: c || 'Vàng Hoàng Yến', hex: '#D97706' };
  }
  if (
    lower.includes('xanh dương') ||
    lower.includes('lam') ||
    lower.includes('thanh') ||
    lower.includes('blue')
  ) {
    return { label: c || 'Thiên Thanh', hex: '#0369A1' };
  }
  if (lower.includes('xanh') || lower.includes('lục') || lower.includes('green')) {
    return { label: c || 'Ngọc Bích', hex: '#047857' };
  }
  if (lower.includes('tím') || lower.includes('purple')) {
    return { label: c || 'Tím Huế', hex: '#7E22CE' };
  }
  if (lower.includes('hồng') || lower.includes('pink')) {
    return { label: c || 'Hồng Phấn', hex: '#BE185D' };
  }
  if (lower.includes('trắng') || lower.includes('white')) {
    return { label: c || 'Trắng Tinh Khôi', hex: '#475569' };
  }
  return { label: c || 'Đỏ Chu Sa', hex: '#BA0049' };
}

function inferCollectionName(product: any): string {
  const style = (product?.style || '').trim();
  const name = (product?.name || '').toLowerCase();
  if (style) {
    if (style.toLowerCase().includes('nhật bình') || name.includes('nhật bình')) {
      return 'BST Hoàng Cung Triều Nguyễn';
    }
    if (style.toLowerCase().includes('ngũ thân') || name.includes('ngũ thân')) {
      return 'BST Hoàng Cung Triều Nguyễn';
    }
    if (style.toLowerCase().includes('áo tấc') || name.includes('áo tấc')) {
      return 'BST Áo Tấc & Trang Phục Lễ Hội';
    }
    return `BST ${style}`;
  }
  if (
    name.includes('ngũ thân') ||
    name.includes('nhật bình') ||
    name.includes('cung đình') ||
    name.includes('hoàng cung')
  ) {
    return 'BST Hoàng Cung Triều Nguyễn';
  }
  if (name.includes('áo tấc') || name.includes('lễ hội') || name.includes('biểu diễn')) {
    return 'BST Áo Tấc & Trang Phục Lễ Hội';
  }
  return 'BST Cổ Phục & Áo Dài Cố Đô';
}

function inferCategoryFilterKey(product: any): string {
  const name = `${product?.name || ''} ${product?.style || ''}`.toLowerCase();
  if (name.includes('nhật bình')) return 'nhat_binh';
  if (name.includes('ngũ thân')) return 'ngu_than';
  if (name.includes('áo tấc') || name.includes('nam')) return 'ao_tac';
  return 'co_phuc';
}

export default function ProviderStoreScreen() {
  const { show } = useToast();
  const { unreadCount } = useNotifications();

  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [performance, setPerformance] = useState<ProviderPerformance | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummaryItem[]>([]);
  const [photographyPackages, setPhotographyPackages] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Main 3-Tab Segmented Control state
  const [storeCategoryTab, setStoreCategoryTab] =
    useState<StoreMainCategoryTab>('AODAI');

  // Filter & View state
  const [viewTab, setViewTab] = useState<InventoryViewTab>('collection');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('all');
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Modals state
  const [selectedProduct, setSelectedProduct] =
    useState<EnrichedInventoryProduct | null>(null);
  const [chipModalVisible, setChipModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [hubModalVisible, setHubModalVisible] = useState(false);
  const [hubInitialTab, setHubInitialTab] = useState<StoreHubTab>('SETTINGS');
  const [pkgComboFormMode, setPkgComboFormMode] =
    useState<PackageComboModalMode>(null);
  const [editingPkgOrCombo, setEditingPkgOrCombo] = useState<any | null>(null);

  const loadStoreAndInventory = useCallback(async () => {
    try {
      const [
        profRes,
        overRes,
        prodRes,
        invRes,
        pkgRes,
        comboRes,
        campRes,
      ] = await Promise.allSettled([
        providerApi.getMe(),
        providerApi.getOverview(),
        providerApi.getMyProducts({ limit: 50 }),
        providerApi.getInventorySummary(),
        providerApi.listPhotographyPackages(),
        providerApi.listCombos(),
        providerApi.getActiveCampaign(),
      ]);

      if (profRes.status === 'fulfilled' && profRes.value) {
        setProfile(profRes.value);
        setIsOnline(profRes.value.isAcceptingBookings ?? true);
      }

      if (overRes.status === 'fulfilled' && overRes.value?.performance) {
        setPerformance(overRes.value.performance);
      }

      if (prodRes.status === 'fulfilled' && prodRes.value) {
        const list = Array.isArray(prodRes.value.items)
          ? prodRes.value.items
          : Array.isArray(prodRes.value)
          ? prodRes.value
          : [];
        setProducts(list);
      }

      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) {
        setInventorySummary(invRes.value);
      }

      if (pkgRes.status === 'fulfilled' && Array.isArray(pkgRes.value)) {
        setPhotographyPackages(pkgRes.value);
      }

      if (comboRes.status === 'fulfilled' && Array.isArray(comboRes.value)) {
        setCombos(comboRes.value);
      }

      if (campRes.status === 'fulfilled' && campRes.value?._id) {
        setActiveCampaign(campRes.value);
      } else {
        setActiveCampaign(null);
      }
    } catch {
      show('Không thể tải dữ liệu cửa hàng & kho', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => {
    void loadStoreAndInventory();
  }, [loadStoreAndInventory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadStoreAndInventory();
  }, [loadStoreAndInventory]);

  // Toggle store online status
  const handleToggleOnline = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    try {
      await providerApi.updateProfile({ isAcceptingBookings: nextState });
      show(
        nextState
          ? 'Đã bật trạng thái mở cửa đón khách'
          : 'Đã tạm ngưng nhận khách trực tiếp',
        'success',
      );
    } catch {
      setIsOnline(!nextState);
      show('Không thể cập nhật trạng thái cửa hàng', 'error');
    }
  };

  // Build EnrichedInventoryProduct[] combining real products & inventorySummary
  const enrichedProducts: EnrichedInventoryProduct[] = useMemo(() => {
    // Group summary items by productId
    const byProduct = new Map<string, InventorySummaryItem[]>();
    inventorySummary.forEach((row) => {
      const pid = String(row.productId);
      const existing = byProduct.get(pid) || [];
      existing.push(row);
      byProduct.set(pid, existing);
    });

    // If products list is populated, enrich each product
    const sourceProducts =
      products.length > 0
        ? products
        : Array.from(byProduct.entries()).map(([pid, rows], idx) => ({
            _id: pid,
            name: rows[0]?.productName || `Mẫu Áo Dài #${idx + 1}`,
            colors: [rows[0]?.color || 'Đỏ Chu Sa'],
            sizes: Array.from(new Set(rows.map((r) => r.size))),
            basePrice: 850000,
            depositAmount: 300000,
            status: 'ACTIVE',
            images: [],
          }));

    return sourceProducts.map((p: any, idx: number) => {
      const pid = String(p._id || p.id);
      const rows = byProduct.get(pid) || [];

      // Aggregate per size
      const sizeMap = new Map<string, SizeStockCell>();
      const declaredSizes: string[] =
        Array.isArray(p.sizes) && p.sizes.length > 0
          ? p.sizes.map((s: string) => s.trim().toUpperCase())
          : ['S', 'M', 'L'];

      declaredSizes.forEach((sz) => {
        sizeMap.set(sz, {
          size: sz,
          available: 0,
          rented: 0,
          maintenance: 0,
          total: 0,
        });
      });

      rows.forEach((r) => {
        const sz = (r.size || 'M').trim().toUpperCase();
        const current = sizeMap.get(sz) || {
          size: sz,
          available: 0,
          rented: 0,
          maintenance: 0,
          total: 0,
        };
        current.available += r.available || 0;
        current.rented += r.rented || 0;
        current.maintenance += r.maintenance || 0;
        current.total += r.total || 0;
        sizeMap.set(sz, current);
      });

      const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', 'FREESIZE'];
      const sizeMatrix = Array.from(sizeMap.values()).sort(
        (a, b) =>
          (sizeOrder.indexOf(a.size) === -1 ? 99 : sizeOrder.indexOf(a.size)) -
          (sizeOrder.indexOf(b.size) === -1 ? 99 : sizeOrder.indexOf(b.size)),
      );

      let totalChips = 0;
      let availableChips = 0;
      let rentedChips = 0;
      let maintenanceChips = 0;

      sizeMatrix.forEach((c) => {
        totalChips += c.total;
        availableChips += c.available;
        rentedChips += c.rented;
        maintenanceChips += c.maintenance;
      });

      const colorMeta = getColorMeta(p.colors?.[0] || rows[0]?.color);
      const shortCode = pid.slice(-4).toUpperCase();
      const rackIndex = (idx % 4) + 1;
      const shelfIndex = ((idx >> 1) % 3) + 1;
      const rackLetter = idx % 2 === 0 ? 'A' : 'B';

      const hasAlert =
        maintenanceChips > 0 ||
        sizeMatrix.some((c) => c.total > 0 && c.available === 0);

      return {
        _id: pid,
        name: p.name || 'Áo Dài Cổ Phục Huế',
        code: `#BST-${shortCode}`,
        collectionName: inferCollectionName(p),
        rackLocation: `Kệ ${rackLetter}${rackIndex} - Tủ 0${shelfIndex}`,
        imageUrl: resolveImageUrl(p.images?.[0], idx),
        colorLabel: colorMeta.label,
        colorHex: colorMeta.hex,
        basePrice: p.basePrice ?? 850000,
        depositAmount: p.depositAmount ?? 300000,
        isActive: (p.status || 'ACTIVE') === 'ACTIVE',
        sizeMatrix,
        totalChips,
        availableChips,
        rentedChips,
        maintenanceChips,
        rfidPrefix: `RFID-${shortCode}`,
        hasAlert,
        rawProduct: p,
      };
    });
  }, [products, inventorySummary]);

  // Keep selectedProduct synced when data refreshes
  useEffect(() => {
    if (selectedProduct) {
      const updated = enrichedProducts.find(
        (item) => item._id === selectedProduct._id,
      );
      if (updated) {
        setSelectedProduct(updated);
      }
    }
  }, [enrichedProducts, selectedProduct]);

  // Overall KPI metrics from real data
  const overviewMetrics = useMemo(() => {
    let totalItems = 0;
    let availableCount = 0;
    let rentedCount = 0;
    let maintenanceCount = 0;
    let alertCount = 0;
    const collectionsSet = new Set<string>();
    const racksSet = new Set<string>();

    enrichedProducts.forEach((p) => {
      totalItems += p.totalChips;
      availableCount += p.availableChips;
      rentedCount += p.rentedChips;
      maintenanceCount += p.maintenanceChips;
      if (p.hasAlert) alertCount++;
      collectionsSet.add(p.collectionName);
      racksSet.add(p.rackLocation.split(' - ')[0]);
    });

    return {
      totalItems,
      collectionsCount: Math.max(collectionsSet.size, 1),
      racksCount: Math.max(racksSet.size, 1),
      availableCount,
      rentedCount,
      maintenanceCount,
      alertCount,
    };
  }, [enrichedProducts]);

  // Dynamic Collection Filter Chips
  const collectionChips: CollectionChip[] = useMemo(() => {
    let coPhuc = 0;
    let nhatBinh = 0;
    let nguThan = 0;
    let aoTac = 0;

    enrichedProducts.forEach((p) => {
      const key = inferCategoryFilterKey(p.rawProduct || p);
      const count = Math.max(p.totalChips, 1);
      if (key === 'nhat_binh') nhatBinh += count;
      else if (key === 'ngu_than') nguThan += count;
      else if (key === 'ao_tac') aoTac += count;
      else coPhuc += count;
    });

    const totalChipCount =
      overviewMetrics.totalItems || enrichedProducts.length;

    return [
      { key: 'all', label: 'Tất cả', count: totalChipCount },
      { key: 'co_phuc', label: 'Cổ Phục Cố Đô', count: coPhuc },
      { key: 'nhat_binh', label: 'Áo Nhật Bình', count: nhatBinh },
      { key: 'ngu_than', label: 'Áo Ngũ Thân', count: nguThan },
      { key: 'ao_tac', label: 'Áo Tấc Nam', count: aoTac },
    ];
  }, [enrichedProducts, overviewMetrics.totalItems]);

  // Dynamic Size Chips
  const sizeChips: SizeChip[] = useMemo(() => {
    const map = new Map<string, number>([
      ['S', 0],
      ['M', 0],
      ['L', 0],
      ['XL', 0],
    ]);
    enrichedProducts.forEach((p) => {
      p.sizeMatrix.forEach((c) => {
        if (map.has(c.size)) {
          map.set(c.size, (map.get(c.size) || 0) + c.total);
        }
      });
    });
    return ['S', 'M', 'L', 'XL'].map((sz) => ({
      size: sz,
      count: map.get(sz) || 0,
    }));
  }, [enrichedProducts]);

  // Filter products based on active filters & search
  const filteredProducts = useMemo(() => {
    return enrichedProducts.filter((p) => {
      // View tab filter
      if (viewTab === 'alert' && !p.hasAlert) {
        return false;
      }

      // Collection chip filter
      if (selectedCollection !== 'all') {
        const key = inferCategoryFilterKey(p.rawProduct || p);
        if (key !== selectedCollection) return false;
      }

      // Status filter
      if (statusFilter === 'available' && p.availableChips <= 0) return false;
      if (statusFilter === 'rented' && p.rentedChips <= 0) return false;
      if (statusFilter === 'maintenance' && p.maintenanceChips <= 0)
        return false;

      // Size filter
      if (selectedSize) {
        const sizeCell = p.sizeMatrix.find((c) => c.size === selectedSize);
        if (!sizeCell || sizeCell.total <= 0) return false;
      }

      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchRfid = p.rfidPrefix.toLowerCase().includes(q);
        const matchRack = p.rackLocation.toLowerCase().includes(q);
        const matchColor = p.colorLabel.toLowerCase().includes(q);
        return matchName || matchCode || matchRfid || matchRack || matchColor;
      }

      return true;
    });
  }, [
    enrichedProducts,
    viewTab,
    selectedCollection,
    statusFilter,
    selectedSize,
    searchQuery,
  ]);

  // Group filtered products by Collection or Rack
  const groupedSections = useMemo(() => {
    const groups = new Map<
      string,
      { title: string; dotColor: string; items: EnrichedInventoryProduct[]; totalChips: number }
    >();

    filteredProducts.forEach((p) => {
      const groupKey =
        viewTab === 'rack'
          ? p.rackLocation.split(' - ')[0]
          : viewTab === 'alert'
          ? 'Hiện Vật Cần Kiểm Định / Bổ Sung Kho'
          : p.collectionName;

      const existing = groups.get(groupKey);
      const dotColor = groupKey.includes('Áo Tấc')
        ? '#0284C7'
        : groupKey.includes('Kiểm Định')
        ? '#F59E0B'
        : '#BA0049';

      if (existing) {
        existing.items.push(p);
        existing.totalChips += p.totalChips;
      } else {
        groups.set(groupKey, {
          title: groupKey,
          dotColor,
          items: [p],
          totalChips: p.totalChips,
        });
      }
    });

    return Array.from(groups.values());
  }, [filteredProducts, viewTab]);

  // Toggle "Bật thuê" on a product
  const handleToggleRentalActive = async (product: EnrichedInventoryProduct) => {
    const nextStatus = product.isActive ? 'INACTIVE' : 'ACTIVE';
    try {
      await providerApi.updateProduct(product._id, { status: nextStatus });
      show(
        nextStatus === 'ACTIVE'
          ? `Đã bật cho thuê "${product.name}"`
          : `Đã tạm ngưng cho thuê "${product.name}"`,
        'success',
      );
      void loadStoreAndInventory();
    } catch {
      show('Không thể cập nhật trạng thái cho thuê', 'error');
    }
  };

  const handleOpenChipDetails = (product: EnrichedInventoryProduct) => {
    setSelectedProduct(product);
    setChipModalVisible(true);
  };

  const handleResetFilters = () => {
    setSelectedCollection('all');
    setStatusFilter('all');
    setSelectedSize(null);
    setSearchQuery('');
    setViewTab('collection');
    show('Đã đặt lại bộ lọc kho', 'info');
  };

  // Lookup maps for Combo card resolution
  const productsMap = useMemo(() => {
    const m = new Map<string, any>();
    products.forEach((p) => m.set(String(p._id || p.id), p));
    enrichedProducts.forEach((p) => {
      if (!m.has(p._id)) m.set(p._id, p);
    });
    return m;
  }, [products, enrichedProducts]);

  const packagesMap = useMemo(() => {
    const m = new Map<string, any>();
    photographyPackages.forEach((pk) => m.set(String(pk._id || pk.id), pk));
    return m;
  }, [photographyPackages]);

  // Actions for Photography Packages
  const handleTogglePackageActive = async (pkg: any) => {
    const isActive = (pkg.status || pkg.Status || 'ACTIVE') === 'ACTIVE';
    try {
      if (isActive) {
        await providerApi.unpublishPhotographyPackage(pkg._id);
        show(`Đã tạm ẩn gói chụp "${pkg.name || pkg.title}"`, 'info');
      } else {
        await providerApi.publishPhotographyPackage(pkg._id);
        show(`Đã mở nhận lịch gói "${pkg.name || pkg.title}"`, 'success');
      }
      void loadStoreAndInventory();
    } catch {
      try {
        await providerApi.updatePhotographyPackage(pkg._id, {
          status: isActive ? 'INACTIVE' : 'ACTIVE',
        });
        show('Đã cập nhật trạng thái gói chụp!', 'success');
        void loadStoreAndInventory();
      } catch {
        show('Không thể đổi trạng thái gói chụp', 'error');
      }
    }
  };

  const handleDeletePackage = async (pkg: any) => {
    try {
      await providerApi.deletePhotographyPackage(pkg._id);
      show(`Đã xóa gói chụp "${pkg.name || pkg.title}"`, 'success');
      void loadStoreAndInventory();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể xóa gói chụp', 'error');
    }
  };

  const handleDeleteCombo = async (combo: any) => {
    try {
      await providerApi.deleteCombo(combo._id);
      show(`Đã xóa gói Combo "${combo.name}"`, 'success');
      void loadStoreAndInventory();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể xóa gói Combo', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Sticky Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandIconCircle}>
            <MaterialIcons name="auto-awesome" size={19} color="#BA0049" />
          </View>
          <View>
            <Text style={styles.headerEyebrow}>LUMÉ PARTNER</Text>
            <Text style={styles.headerTitle}>Cửa Hàng & Kho</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            style={styles.notifBtn}
            onPress={() => router.push('/notifications' as Href)}
            accessibilityLabel="Thông báo"
          >
            <Ionicons name="notifications-outline" size={21} color="#5B3F43" />
            {unreadCount > 0 && <View style={styles.notifDot} />}
          </Pressable>

          <Pressable
            style={styles.profileCircle}
            onPress={() => router.push('/(tabs)/profile' as Href)}
            accessibilityLabel="Tài khoản"
          >
            <MaterialIcons name="person" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#BA0049" />
          <Text style={styles.loadingText}>
            Đang đồng bộ dữ liệu kho RFID...
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#BA0049']}
                tintColor="#BA0049"
              />
            }
          >
            {/* 1. Profile & Store Status Card */}
            <StoreProfileHeaderCard
              profile={profile}
              performance={performance}
              isOnline={isOnline}
              onToggleOnline={handleToggleOnline}
            />

            {/* 1b. Quick Store Management Hub Strip (Web Parity: Settings, Vouchers, Packages, Analytics) */}
            <View style={styles.hubStripRow}>
              {(
                [
                  { tab: 'SETTINGS', label: 'Hồ sơ tiệm', icon: 'settings-outline' },
                  { tab: 'VOUCHERS', label: 'Voucher', icon: 'pricetag-outline' },
                  { tab: 'PACKAGES', label: 'Portfolio', icon: 'images-outline' },
                  { tab: 'ANALYTICS', label: 'Doanh thu', icon: 'stats-chart-outline' },
                ] as const
              ).map((btn) => (
                <Pressable
                  key={btn.tab}
                  style={styles.hubActionCard}
                  onPress={() => {
                    setHubInitialTab(btn.tab);
                    setHubModalVisible(true);
                  }}
                >
                  <View style={styles.hubIconCircle}>
                    <Ionicons name={btn.icon} size={17} color="#BA0049" />
                  </View>
                  <Text style={styles.hubActionLabel} numberOfLines={1}>
                    {btn.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 1c. Segmented Category Control (Kho Cổ Phục | Gói Chụp | Combo) */}
            <View style={styles.segmentedBar}>
              <Pressable
                style={[
                  styles.segmentTab,
                  storeCategoryTab === 'AODAI' && styles.segmentTabActive,
                ]}
                onPress={() => setStoreCategoryTab('AODAI')}
              >
                <MaterialIcons
                  name="checkroom"
                  size={16}
                  color={storeCategoryTab === 'AODAI' ? '#FFFFFF' : '#5B3F43'}
                />
                <Text
                  style={[
                    styles.segmentTabText,
                    storeCategoryTab === 'AODAI' && styles.segmentTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Kho Cổ Phục ({overviewMetrics.totalItems || enrichedProducts.length})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.segmentTab,
                  storeCategoryTab === 'PHOTOGRAPHY' && styles.segmentTabActive,
                ]}
                onPress={() => setStoreCategoryTab('PHOTOGRAPHY')}
              >
                <Ionicons
                  name="camera-outline"
                  size={15}
                  color={storeCategoryTab === 'PHOTOGRAPHY' ? '#FFFFFF' : '#5B3F43'}
                />
                <Text
                  style={[
                    styles.segmentTabText,
                    storeCategoryTab === 'PHOTOGRAPHY' && styles.segmentTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Gói Chụp ({photographyPackages.length})
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.segmentTab,
                  storeCategoryTab === 'COMBO' && styles.segmentTabActive,
                ]}
                onPress={() => setStoreCategoryTab('COMBO')}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={15}
                  color={storeCategoryTab === 'COMBO' ? '#FFFFFF' : '#5B3F43'}
                />
                <Text
                  style={[
                    styles.segmentTabText,
                    storeCategoryTab === 'COMBO' && styles.segmentTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Combo ({combos.length})
                </Text>
              </Pressable>
            </View>

            {/* TAB CONTENT 1: KHO CỔ PHỤC & RFID */}
            {storeCategoryTab === 'AODAI' && (
              <>
                {/* 2. Inventory Breakdown Visualizer */}
                <InventoryBreakdownCard
                  totalItems={overviewMetrics.totalItems}
                  collectionsCount={overviewMetrics.collectionsCount}
                  racksCount={overviewMetrics.racksCount}
                  availableCount={overviewMetrics.availableCount}
                  rentedCount={overviewMetrics.rentedCount}
                  maintenanceCount={overviewMetrics.maintenanceCount}
                  alertCount={overviewMetrics.alertCount}
                  activeTab={viewTab}
                  onSelectTab={setViewTab}
                />

                {/* 3. Search & Multi-Layer Filter Section */}
                <InventoryFilterSection
                  searchQuery={searchQuery}
                  onChangeSearch={setSearchQuery}
                  onPressScanRfid={() => router.push('/provider/qr-scanner' as Href)}
                  onResetFilters={handleResetFilters}
                  collections={collectionChips}
                  selectedCollection={selectedCollection}
                  onSelectCollection={setSelectedCollection}
                  statusFilter={statusFilter}
                  onSelectStatusFilter={setStatusFilter}
                  statusCounts={{
                    available: overviewMetrics.availableCount,
                    rented: overviewMetrics.rentedCount,
                    maintenance: overviewMetrics.maintenanceCount,
                  }}
                  sizes={sizeChips}
                  selectedSize={selectedSize}
                  onSelectSize={setSelectedSize}
                />

                {/* 4. Detailed Inventory Matrix Grouped by Collection / Rack */}
                {groupedSections.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <MaterialIcons name="checkroom" size={40} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>
                      Không tìm thấy hiện vật phù hợp
                    </Text>
                    <Text style={styles.emptySub}>
                      Thử đổi bộ lọc size/trạng thái hoặc thêm mẫu áo dài mới vào kho.
                    </Text>
                    <Pressable
                      style={styles.resetFilterBtn}
                      onPress={handleResetFilters}
                    >
                      <Text style={styles.resetFilterBtnText}>Xem tất cả kho</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.sectionsContainer}>
                    {groupedSections.map((group) => (
                      <View key={group.title} style={styles.groupSection}>
                        {/* Group Header */}
                        <View style={styles.groupHeader}>
                          <View style={styles.groupHeaderLeft}>
                            <View
                              style={[
                                styles.groupDot,
                                { backgroundColor: group.dotColor },
                              ]}
                            />
                            <Text style={styles.groupTitle} numberOfLines={1}>
                              {group.title}
                            </Text>
                            <View style={styles.groupCountBadge}>
                              <Text style={styles.groupCountText}>
                                {group.totalChips} hiện vật
                              </Text>
                            </View>
                          </View>

                          <Pressable
                            style={styles.viewAllBtn}
                            onPress={() => {
                              if (selectedCollection !== 'all') {
                                setSelectedCollection('all');
                              } else {
                                show(`Đang hiển thị toàn bộ ${group.title}`, 'info');
                              }
                            }}
                          >
                            <Text style={styles.viewAllText}>Xem tất cả</Text>
                            <MaterialIcons
                              name="arrow-forward-ios"
                              size={11}
                              color="#BA0049"
                            />
                          </Pressable>
                        </View>

                        {/* Cards in Group */}
                        <View style={styles.groupCardsList}>
                          {group.items.map((item) => (
                            <InventoryProductMatrixCard
                              key={item._id}
                              product={item}
                              onPressChipDetails={handleOpenChipDetails}
                              onToggleRentalActive={handleToggleRentalActive}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* TAB CONTENT 2: GÓI CHỤP ẢNH (PHOTOGRAPHY PACKAGES) */}
            {storeCategoryTab === 'PHOTOGRAPHY' && (
              <View style={styles.sectionsContainer}>
                <View style={styles.tabSummaryBanner}>
                  <View style={styles.tabSummaryLeft}>
                    <View style={styles.tabSummaryIconBox}>
                      <Ionicons name="camera" size={20} color="#BA0049" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tabSummaryTitle}>
                        Danh sách Gói chụp ảnh ({photographyPackages.length})
                      </Text>
                      <Text style={styles.tabSummarySub}>
                        Bật/tắt nhận lịch hoặc điều chỉnh giá, thời lượng trực tiếp
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.tabAddQuickBtn}
                    onPress={() => {
                      setEditingPkgOrCombo(null);
                      setPkgComboFormMode('PACKAGE');
                    }}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.tabAddQuickBtnText}>Thêm gói</Text>
                  </Pressable>
                </View>

                {photographyPackages.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="camera-outline" size={40} color="#BA0049" />
                    <Text style={styles.emptyTitle}>
                      Cửa hàng chưa có gói chụp ảnh nào
                    </Text>
                    <Text style={styles.emptySub}>
                      Tạo gói chụp ảnh ngoại cảnh hoặc tại Studio để khách hàng đặt lịch trực tiếp và ghép vào các Gói Combo.
                    </Text>
                    <Pressable
                      style={styles.resetFilterBtn}
                      onPress={() => {
                        setEditingPkgOrCombo(null);
                        setPkgComboFormMode('PACKAGE');
                      }}
                    >
                      <Text style={styles.resetFilterBtnText}>
                        + Tạo gói chụp ảnh đầu tiên
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.groupCardsList}>
                    {photographyPackages.map((pkg) => (
                      <PhotographyPackageItemCard
                        key={pkg._id || pkg.id}
                        pkg={pkg}
                        onToggleActive={handleTogglePackageActive}
                        onPressEdit={(item) => {
                          setEditingPkgOrCombo(item);
                          setPkgComboFormMode('PACKAGE');
                        }}
                        onPressDelete={handleDeletePackage}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* TAB CONTENT 3: GÓI COMBO & CHIẾN DỊCH KHUYẾN MÃI */}
            {storeCategoryTab === 'COMBO' && (
              <View style={styles.sectionsContainer}>
                {/* Store-wide Campaign Banner */}
                <View style={styles.campaignBannerCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campaignEyebrow}>
                      CHIẾN DỊCH FLASH SALE TOÀN TIỆM
                    </Text>
                    <Text style={styles.campaignTitle}>
                      {activeCampaign
                        ? `🔥 ${activeCampaign.occasion} (-${activeCampaign.discountPercent}%)`
                        : 'Chưa bật chiến dịch giảm giá toàn cửa hàng'}
                    </Text>
                    <Text style={styles.campaignSub}>
                      {activeCampaign
                        ? 'Đang tự động giảm giá tất cả mẫu cổ phục trong tiệm'
                        : 'Bật chiến dịch dịp lễ để thu hút khách thuê cổ phục Cố đô'}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.campaignManageBtn}
                    onPress={() => {
                      setHubInitialTab('VOUCHERS');
                      setHubModalVisible(true);
                    }}
                  >
                    <Text style={styles.campaignManageBtnText}>
                      {activeCampaign ? 'Cấu hình' : 'Kích hoạt'}
                    </Text>
                  </Pressable>
                </View>

                {/* Combos Section Header */}
                <View style={styles.tabSummaryBanner}>
                  <View style={styles.tabSummaryLeft}>
                    <View style={styles.tabSummaryIconBox}>
                      <Ionicons name="sparkles" size={19} color="#BA0049" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tabSummaryTitle}>
                        Gói Combo Cổ Phục + Chụp Ảnh ({combos.length})
                      </Text>
                      <Text style={styles.tabSummarySub}>
                        Ghép mẫu áo dài với gói chụp ảnh kèm ưu đãi giảm giá
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.tabAddQuickBtn}
                    onPress={() => {
                      setEditingPkgOrCombo(null);
                      setPkgComboFormMode('COMBO');
                    }}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.tabAddQuickBtnText}>Tạo Combo</Text>
                  </Pressable>
                </View>

                {combos.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="sparkles-outline" size={40} color="#BA0049" />
                    <Text style={styles.emptyTitle}>
                      Chưa có Gói Combo ưu đãi nào
                    </Text>
                    <Text style={styles.emptySub}>
                      Ghép 1 mẫu Áo dài cổ phục + 1 Gói chụp ảnh với mức giảm giá ưu đãi để khách hàng đặt trọn gói nhanh chóng.
                    </Text>
                    <Pressable
                      style={styles.resetFilterBtn}
                      onPress={() => {
                        setEditingPkgOrCombo(null);
                        setPkgComboFormMode('COMBO');
                      }}
                    >
                      <Text style={styles.resetFilterBtnText}>
                        + Ghép Gói Combo đầu tiên
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.groupCardsList}>
                    {combos.map((cb) => (
                      <ComboPromotionItemCard
                        key={cb._id || cb.id}
                        combo={cb}
                        productsMap={productsMap}
                        packagesMap={packagesMap}
                        onPressEdit={(item) => {
                          setEditingPkgOrCombo(item);
                          setPkgComboFormMode('COMBO');
                        }}
                        onPressDelete={handleDeleteCombo}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* 5. Sticky Floating Action Buttons (Adapts to Active Tab) */}
          <View style={styles.fabRow} pointerEvents="box-none">
            {storeCategoryTab === 'AODAI' && (
              <Pressable
                style={({ pressed }) => [
                  styles.fabSecondary,
                  pressed && styles.fabPressed,
                ]}
                onPress={() => router.push('/provider/qr-scanner' as Href)}
              >
                <MaterialIcons name="sensors" size={19} color="#BA0049" />
                <Text style={styles.fabSecondaryText}>Quét hàng loạt RFID</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.fabPrimary,
                pressed && styles.fabPressed,
              ]}
              onPress={() => {
                if (storeCategoryTab === 'PHOTOGRAPHY') {
                  setEditingPkgOrCombo(null);
                  setPkgComboFormMode('PACKAGE');
                } else if (storeCategoryTab === 'COMBO') {
                  setEditingPkgOrCombo(null);
                  setPkgComboFormMode('COMBO');
                } else {
                  setAddModalVisible(true);
                }
              }}
            >
              <MaterialIcons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.fabPrimaryText}>
                {storeCategoryTab === 'PHOTOGRAPHY'
                  ? 'Thêm gói chụp mới'
                  : storeCategoryTab === 'COMBO'
                    ? 'Ghép Combo mới'
                    : 'Thêm mẫu mới'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Modals */}
      <RfidChipDetailModal
        visible={chipModalVisible}
        product={selectedProduct}
        onClose={() => setChipModalVisible(false)}
        onUpdated={() => void loadStoreAndInventory()}
      />

      <AddProductModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onCreated={() => void loadStoreAndInventory()}
      />

      <StoreManagementHubModal
        visible={hubModalVisible}
        initialTab={hubInitialTab}
        profile={profile}
        onClose={() => setHubModalVisible(false)}
        onUpdated={() => void loadStoreAndInventory()}
      />

      <PackageAndComboFormModal
        visible={pkgComboFormMode !== null}
        mode={pkgComboFormMode}
        editingItem={editingPkgOrCombo}
        products={products.length > 0 ? products : enrichedProducts}
        packages={photographyPackages}
        onClose={() => {
          setPkgComboFormMode(null);
          setEditingPkgOrCombo(null);
        }}
        onSaved={() => void loadStoreAndInventory()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF9F9',
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(251, 249, 249, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#E9E8E7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(227, 28, 95, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#5B3F43',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
    marginTop: -1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#BA0049',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  profileCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#5B3F43',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 96,
    gap: 18,
  },
  hubStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hubActionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    alignItems: 'center',
    gap: 6,
  },
  hubIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubActionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#1B1C1C',
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 5,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    gap: 5,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  segmentTabActive: {
    backgroundColor: '#BA0049',
  },
  segmentTabText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#5B3F43',
    flexShrink: 1,
  },
  segmentTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  tabSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    gap: 10,
  },
  tabSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  tabSummaryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSummaryTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  tabSummarySub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    marginTop: 1,
  },
  tabAddQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#BA0049',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
  },
  tabAddQuickBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  campaignBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF8F9',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFD9DE',
    gap: 10,
  },
  campaignEyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
    letterSpacing: 0.6,
  },
  campaignTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
    marginTop: 2,
  },
  campaignSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    marginTop: 2,
  },
  campaignManageBtn: {
    backgroundColor: '#BA0049',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
  },
  campaignManageBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  sectionsContainer: {
    gap: 18,
  },
  groupSection: {
    gap: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  groupDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  groupTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
    flexShrink: 1,
  },
  groupCountBadge: {
    backgroundColor: '#E9E8E7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  groupCountText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#5B3F43',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#BA0049',
  },
  groupCardsList: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9E8E7',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    textAlign: 'center',
  },
  resetFilterBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(186, 0, 73, 0.1)',
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#BA0049',
  },
  fabRow: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  fabSecondary: {
    height: 44,
    paddingHorizontal: 15,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(186, 0, 73, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  fabSecondaryText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#BA0049',
  },
  fabPrimary: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 99,
    backgroundColor: '#BA0049',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#BA0049',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabPrimaryText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});

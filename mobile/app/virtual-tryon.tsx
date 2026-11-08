import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiApi } from '@/apis/aiApi';
import { productApi } from '@/apis/productApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { FontFamily, Radius, Shadow } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import type { AiRecommendedProduct } from '@/types/ai';
import type { Product } from '@/types/product';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';

type ViewMode = 'SPLIT' | 'OVERLAY';

const BACKDROP_THEMES = [
  { id: 'IMPERIAL', label: 'Đại Nội Kinh Thành', tone: '#581C34' },
  { id: 'RIVER', label: 'Hoàng hôn Sông Hương', tone: '#7C2D12' },
  { id: 'TOMB', label: 'Rêu phong Lăng Tẩm', tone: '#1E3A2F' },
];

const formatVnd = (n: number) => `${Math.round(n || 0).toLocaleString('vi-VN')}đ`;
const getProductImage = (p: Product) => getMediaUrl(p.images?.[0]);
const getProductPrice = (p: Product) => p.discountedPrice ?? p.basePrice ?? 0;

export default function VirtualTryOnRoute() {
  return (
    <RequireAuth>
      <VirtualTryOnScreen />
    </RequireAuth>
  );
}

function VirtualTryOnScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { show } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [userPhoto, setUserPhoto] = useState<{
    uri: string;
    base64: string;
    mimeType: string;
  } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('SPLIT');
  const [overlayScale, setOverlayScale] = useState(1);
  const [overlayOffsetY, setOverlayOffsetY] = useState(0);
  const [backdrop, setBackdrop] = useState(BACKDROP_THEMES[0]);

  const [analyzing, setAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiSuggestedProducts, setAiSuggestedProducts] = useState<AiRecommendedProduct[]>([]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoadingProducts(true);
      try {
        const [featuredList, target] = await Promise.all([
          productApi.featured(10).catch(() => [] as Product[]),
          productId ? productApi.detail(productId).catch(() => null) : Promise.resolve(null),
        ]);
        if (!mounted) return;
        const merged: Product[] = [];
        if (target) merged.push(target);
        featuredList.forEach((p) => {
          if (!merged.some((m) => m._id === p._id)) merged.push(p);
        });
        setProducts(merged);
        setSelectedProduct(target ?? merged[0] ?? null);
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, [productId]);

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền truy cập thư viện ảnh để thử đồ ảo', 'error');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.65,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setUserPhoto({
        uri: res.assets[0].uri,
        base64: res.assets[0].base64,
        mimeType: res.assets[0].mimeType || 'image/jpeg',
      });
      setAiFeedback(null);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền máy ảnh để chụp ảnh thử đồ', 'error');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.65,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setUserPhoto({
        uri: res.assets[0].uri,
        base64: res.assets[0].base64,
        mimeType: res.assets[0].mimeType || 'image/jpeg',
      });
      setAiFeedback(null);
    }
  };

  const runAiTryOnAnalysis = async () => {
    if (!userPhoto) {
      show('Hãy tải lên ảnh chân dung hoặc toàn thân của bạn trước', 'error');
      return;
    }
    if (!selectedProduct) {
      show('Hãy chọn một mẫu Áo dài bên dưới để thử', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const prompt = `Tôi muốn thử mẫu "${selectedProduct.name}" (Phong cách: ${
        selectedProduct.style || 'Cổ phục'
      }, Chất liệu: ${selectedProduct.materials?.join(', ') || 'Lụa Gấm'}) để chụp tại ${
        backdrop.label
      }. Hãy phân tích xem tông da, vóc dáng trong ảnh của tôi có hợp với mẫu áo dài này không, gợi ý cách phối phụ kiện (mấn, quạt, guốc) và tư vấn kiểu tóc phù hợp.`;
      const reply = await aiApi.chatWithImage({
        message: prompt,
        image_base64: userPhoto.base64,
        mime_type: userPhoto.mimeType,
      });
      setAiFeedback(reply.answer);
      setAiSuggestedProducts(reply.recommended_products ?? []);
      show('AI Stylist đã hoàn tất phân tích độ hợp dáng!', 'success');
    } catch (cause) {
      show(getApiErrorMessage(cause, 'AI đang bận, vui lòng thử lại sau'), 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const garmentImg = selectedProduct ? getProductImage(selectedProduct) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#1E1418" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TÀGO VIRTUAL ATELIER</Text>
          <Text style={s.title}>Phòng Thử Đồ Ảo AI 2D</Text>
        </View>
        <Pressable
          style={s.aiChatBtn}
          onPress={() => router.push('/ai-assistant' as Href)}
        >
          <Ionicons name="sparkles" size={14} color="#BA0049" />
          <Text style={s.aiChatBtnText}>AI Stylist</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Mirror Stage */}
        <View style={[s.mirrorCard, { borderColor: backdrop.tone }]}>
          <View style={s.mirrorTopBar}>
            <View style={s.backdropBadge}>
              <Ionicons name="compass-outline" size={13} color="#FFFFFF" />
              <Text style={s.backdropBadgeText}>Bối cảnh: {backdrop.label}</Text>
            </View>
            <View style={s.modeSwitch}>
              <Pressable
                onPress={() => setViewMode('SPLIT')}
                style={[s.modeBtn, viewMode === 'SPLIT' && s.modeBtnActive]}
              >
                <Text style={[s.modeBtnText, viewMode === 'SPLIT' && s.modeBtnTextActive]}>
                  Song song
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode('OVERLAY')}
                style={[s.modeBtn, viewMode === 'OVERLAY' && s.modeBtnActive]}
              >
                <Text style={[s.modeBtnText, viewMode === 'OVERLAY' && s.modeBtnTextActive]}>
                  Ướm thử 2D
                </Text>
              </Pressable>
            </View>
          </View>

          {viewMode === 'SPLIT' ? (
            <View style={s.splitStage}>
              <Pressable style={s.splitPane} onPress={() => void pickFromGallery()}>
                {userPhoto ? (
                  <Image
                    source={{ uri: userPhoto.uri }}
                    style={s.stageImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={s.emptyPhotoBox}>
                    <View style={s.uploadCircle}>
                      <Ionicons name="person-add-outline" size={24} color="#BA0049" />
                    </View>
                    <Text style={s.emptyPhotoTitle}>Ảnh của bạn</Text>
                    <Text style={s.emptyPhotoSub}>Chạm để tải ảnh chân dung hoặc toàn thân</Text>
                  </View>
                )}
                <View style={s.paneLabel}>
                  <Text style={s.paneLabelText}>NGƯỜI MẶC</Text>
                </View>
              </Pressable>

              <View style={s.splitDivider}>
                <View style={s.plusBadge}>
                  <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                </View>
              </View>

              <View style={s.splitPane}>
                {garmentImg ? (
                  <Image source={{ uri: garmentImg }} style={s.stageImage} contentFit="cover" />
                ) : (
                  <View style={s.emptyPhotoBox}>
                    <Ionicons name="shirt-outline" size={28} color="#8C7A82" />
                    <Text style={s.emptyPhotoSub}>Chọn mẫu áo bên dưới</Text>
                  </View>
                )}
                <View style={[s.paneLabel, { backgroundColor: 'rgba(186,0,73,0.88)' }]}>
                  <Text style={s.paneLabelText}>CỔ PHỤC ĐANG THỬ</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.overlayStage}>
              {userPhoto ? (
                <Image
                  source={{ uri: userPhoto.uri }}
                  style={s.stageImage}
                  contentFit="cover"
                />
              ) : (
                <Pressable style={s.emptyPhotoBox} onPress={() => void pickFromGallery()}>
                  <View style={s.uploadCircle}>
                    <Ionicons name="camera-outline" size={26} color="#BA0049" />
                  </View>
                  <Text style={s.emptyPhotoTitle}>Tải ảnh của bạn lên gương 2D</Text>
                  <Text style={s.emptyPhotoSub}>
                    Chạm để chọn ảnh toàn thân và ướm trực tiếp cổ phục lên người
                  </Text>
                </Pressable>
              )}

              {garmentImg && (
                <View
                  pointerEvents="none"
                  style={[
                    s.garmentOverlayCard,
                    {
                      transform: [{ scale: overlayScale }, { translateY: overlayOffsetY }],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: garmentImg }}
                    style={s.garmentOverlayImg}
                    contentFit="cover"
                  />
                  <View style={s.garmentOverlayTag}>
                    <Text style={s.garmentOverlayTagText} numberOfLines={1}>
                      {selectedProduct?.name}
                    </Text>
                  </View>
                </View>
              )}

              <View style={s.overlayControls}>
                <Pressable
                  style={s.ctrlBtn}
                  onPress={() => setOverlayScale((v) => Math.max(0.75, +(v - 0.1).toFixed(2)))}
                >
                  <Ionicons name="remove" size={16} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  style={s.ctrlBtn}
                  onPress={() => setOverlayScale((v) => Math.min(1.35, +(v + 0.1).toFixed(2)))}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  style={s.ctrlBtn}
                  onPress={() => setOverlayOffsetY((v) => v - 14)}
                >
                  <Ionicons name="arrow-up" size={15} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  style={s.ctrlBtn}
                  onPress={() => setOverlayOffsetY((v) => v + 14)}
                >
                  <Ionicons name="arrow-down" size={15} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          )}

          {/* Photo upload buttons */}
          <View style={s.photoActionRow}>
            <Pressable style={s.photoActionBtn} onPress={() => void pickFromGallery()}>
              <Ionicons name="images-outline" size={16} color="#BA0049" />
              <Text style={s.photoActionText}>
                {userPhoto ? 'Đổi ảnh từ thư viện' : 'Chọn ảnh thư viện'}
              </Text>
            </Pressable>
            <Pressable style={s.photoActionBtn} onPress={() => void takePhoto()}>
              <Ionicons name="camera-outline" size={16} color="#BA0049" />
              <Text style={s.photoActionText}>Chụp ảnh mới</Text>
            </Pressable>
          </View>
        </View>

        {/* Backdrop Picker */}
        <View style={s.sectionCard}>
          <Text style={s.sectionLabel}>1. CHỌN BỐI CẢNH ÁNH SÁNG CỐ ĐÔ</Text>
          <View style={s.backdropRow}>
            {BACKDROP_THEMES.map((item) => {
              const active = backdrop.id === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setBackdrop(item)}
                  style={[s.backdropChip, active && s.backdropChipActive]}
                >
                  <View style={[s.toneDot, { backgroundColor: item.tone }]} />
                  <Text style={[s.backdropChipText, active && s.backdropChipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Garment Carousel */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionLabel}>2. CHỌN CỔ PHỤC & ÁO DÀI ĐỂ ƯỚM THỬ</Text>
            {selectedProduct && (
              <Pressable
                onPress={() => router.push(`/product/${selectedProduct._id}` as Href)}
              >
                <Text style={s.linkText}>Xem chi tiết mẫu →</Text>
              </Pressable>
            )}
          </View>

          {loadingProducts ? (
            <ActivityIndicator color="#BA0049" style={{ marginVertical: 16 }} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.garmentRow}
            >
              {products.map((item) => {
                const active = selectedProduct?._id === item._id;
                const img = getProductImage(item);
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => {
                      setSelectedProduct(item);
                      setAiFeedback(null);
                    }}
                    style={[s.garmentCard, active && s.garmentCardActive]}
                  >
                    <Image source={{ uri: img }} style={s.garmentThumb} contentFit="cover" />
                    <View style={s.garmentInfo}>
                      <Text style={s.garmentName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={s.garmentPrice}>{formatVnd(getProductPrice(item))}/ngày</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* AI Fit Analysis CTA */}
        <Pressable
          style={[s.analyzeCta, analyzing && { opacity: 0.7 }]}
          disabled={analyzing}
          onPress={() => void runAiTryOnAnalysis()}
        >
          {analyzing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          )}
          <Text style={s.analyzeCtaText}>
            {analyzing
              ? 'AI Stylist đang phân tích vóc dáng & tông da...'
              : 'Phân tích Độ Hợp Dáng & Phối Phụ Kiện bằng AI'}
          </Text>
        </Pressable>

        {/* AI Feedback Result */}
        {aiFeedback && (
          <View style={s.aiResultCard}>
            <View style={s.aiResultHeader}>
              <View style={s.aiAvatar}>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.aiResultTitle}>Nhận xét từ Cố vấn Thẩm mỹ TàGo AI</Text>
                <Text style={s.aiResultSub}>
                  Đánh giá riêng cho mẫu {selectedProduct?.name}
                </Text>
              </View>
            </View>
            <Text style={s.aiResultBody}>{aiFeedback}</Text>

            {selectedProduct && (
              <Pressable
                style={s.rentNowBtn}
                onPress={() => router.push(`/product/${selectedProduct._id}` as Href)}
              >
                <Text style={s.rentNowBtnText}>
                  Đặt thuê ngay mẫu {selectedProduct.name}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        )}

        {aiSuggestedProducts.length > 0 && (
          <View style={s.sectionCard}>
            <Text style={s.sectionLabel}>CÁC THIẾT KẾ TƯƠNG ĐỒNG AI ĐỀ XUẤT</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {aiSuggestedProducts.map((p) => (
                <Pressable
                  key={p._id}
                  style={s.garmentCard}
                  onPress={() => router.push(`/product/${p._id}` as Href)}
                >
                  <Image
                    source={{ uri: getMediaUrl(p.images?.[0]) }}
                    style={s.garmentThumb}
                    contentFit="cover"
                  />
                  <View style={s.garmentInfo}>
                    <Text style={s.garmentName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {p.basePrice != null && (
                      <Text style={s.garmentPrice}>{formatVnd(p.basePrice)}/ngày</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFBF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6EA',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    backgroundColor: '#FAF6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#BA0049',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#1E1418',
  },
  aiChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  aiChatBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#BA0049',
  },
  content: {
    padding: 16,
    paddingBottom: 44,
    gap: 16,
  },
  mirrorCard: {
    borderRadius: Radius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    overflow: 'hidden',
    ...Shadow,
  },
  mirrorTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1E1418',
  },
  backdropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  backdropBadgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.pill,
    padding: 2,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  modeBtnActive: {
    backgroundColor: '#BA0049',
  },
  modeBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#E5DCE0',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  splitStage: {
    height: 310,
    flexDirection: 'row',
    backgroundColor: '#FAF6F8',
    position: 'relative',
  },
  splitPane: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  splitDivider: {
    width: 2,
    backgroundColor: '#EFE6EA',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  plusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageImage: {
    width: '100%',
    height: '100%',
  },
  emptyPhotoBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  uploadCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotoTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1E1418',
    textAlign: 'center',
  },
  emptyPhotoSub: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#8C7A82',
    textAlign: 'center',
  },
  paneLabel: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(30,20,24,0.75)',
    alignItems: 'center',
  },
  paneLabelText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  overlayStage: {
    height: 340,
    backgroundColor: '#FAF6F8',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  garmentOverlayCard: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    width: 142,
    height: 205,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...Shadow,
  },
  garmentOverlayImg: {
    width: '100%',
    height: '100%',
  },
  garmentOverlayTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(186,0,73,0.9)',
  },
  garmentOverlayTagText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  overlayControls: {
    position: 'absolute',
    left: 12,
    bottom: 14,
    flexDirection: 'row',
    gap: 6,
  },
  ctrlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(30,20,24,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EFE6EA',
    backgroundColor: '#FFFFFF',
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#EFE6EA',
  },
  photoActionText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#BA0049',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    padding: 15,
    gap: 12,
    ...Shadow,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: '#8C7A82',
  },
  linkText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#BA0049',
  },
  backdropRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  backdropChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#EFE6EA',
  },
  backdropChipActive: {
    backgroundColor: '#FFF0F5',
    borderColor: '#BA0049',
  },
  toneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  backdropChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#4F3F46',
  },
  backdropChipTextActive: {
    color: '#BA0049',
    fontFamily: FontFamily.bodyBold,
  },
  garmentRow: {
    gap: 10,
  },
  garmentCard: {
    width: 126,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: '#EFE6EA',
    backgroundColor: '#FAF6F8',
    overflow: 'hidden',
  },
  garmentCardActive: {
    borderColor: '#BA0049',
    backgroundColor: '#FFF0F5',
  },
  garmentThumb: {
    width: '100%',
    height: 138,
  },
  garmentInfo: {
    padding: 8,
    gap: 2,
  },
  garmentName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#1E1418',
  },
  garmentPrice: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: '#BA0049',
  },
  analyzeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: '#BA0049',
    ...Shadow,
  },
  analyzeCtaText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  aiResultCard: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
    gap: 12,
  },
  aiResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiResultTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1E1418',
  },
  aiResultSub: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#7A5C68',
  },
  aiResultBody: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    lineHeight: 20,
    color: '#2A1D22',
  },
  rentNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    backgroundColor: '#1E1418',
  },
  rentNowBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});

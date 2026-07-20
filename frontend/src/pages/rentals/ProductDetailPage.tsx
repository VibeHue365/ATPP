import React, { useState, useEffect } from "react";
import { checkProductAvailability } from '../../features/rentals/services/productAvailabilityService';
import { useProductAvailability } from '../../features/rentals/hooks/useProductAvailability';
import { useParams, useNavigate } from "react-router-dom";
import {Heart,Star,Sparkles,ArrowRight,ChevronRight,ChevronLeft,Shield,Camera,User,Check,MapPin,Flag,} from "lucide-react";
import Swal from "sweetalert2";
import { httpClient } from "../../services/httpClient";
import { useToast } from "../../components/feedback/Toast";
import { useCart } from "../../context/CartContext";
import { Modal } from "../../components/common/Modal";
import { ROUTES } from "../../config/routes";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { API_BASE_URL } from "../../config/env";
import { SmartTagList } from "../../features/smart-tagging/components/SmartTagList";
import type { PublicSmartTagBadge } from "../../features/smart-tagging/types/smartTag.types";

const getImageUrl = (url: string) => {
  if (!url)
    return "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
};

interface ProductDetail {
  _id: string;
  name: string;
  description: string;
  images: string[];
  basePrice: number;
  hourlyPrice?: number | null;
  depositAmount: number;
  sizes: string[];
  colors: string[];
  materials: string[];
  rating: {
    averageRating: number;
    totalReviews: number;
  };
  providerId: {
    _id: string;
    businessName: string;
    contact?: {
      email: string;
      phone: string;
      website?: string | null;
    };
    address?: {
      addressLine: string;
      ward?: string | null;
      district?: string | null;
      city?: string | null;
    };
  };
  activeCampaign?: {
    occasion: string;
    discountPercent: number;
    endDate: string;
  } | null;
  discountedPrice?: number;
  badges?: PublicSmartTagBadge[];
}

const timeSlots = [
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
];

const productSlots = [
  { start: "07:00", end: "09:00", label: "07:00 - 09:00" },
  { start: "09:00", end: "11:00", label: "09:00 - 11:00" },
  { start: "11:00", end: "13:00", label: "11:00 - 13:00" },
  { start: "13:00", end: "15:00", label: "13:00 - 15:00" },
  { start: "15:00", end: "17:00", label: "15:00 - 17:00" },
  { start: "17:00", end: "19:00", label: "17:00 - 19:00" },
  { start: "19:00", end: "21:00", label: "19:00 - 21:00" },
];

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { addToCart } = useCart();
  const {
    isAuthenticated,
    user,
    toggleFavorite: apiToggleFavorite,
  } = useAuth();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery Active Image
  const [activeImage, setActiveImage] = useState<string>("");

  // Reviews and Ratings States
  const [realReviews, setRealReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);

  // Review permission & filter states
  const [reviewStatus, setReviewStatus] = useState<{
    canReview: boolean;
    hasCompletedBooking: boolean;
    alreadyReviewed: boolean;
    bookingId?: string;
    bookingItemId?: string;
  } | null>(null);
  const [reviewSortOrder, setReviewSortOrder] = useState<
    "newest" | "highest" | "lowest"
  >("newest");
  const [reviewFilterHasImage, setReviewFilterHasImage] =
    useState<boolean>(false);

  // Write Review Modal States
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState<boolean>(false);
  const [writeRating, setWriteRating] = useState<number>(5);
  const [writeComment, setWriteComment] = useState<string>("");
  const [writeImages, setWriteImages] = useState<string[]>([]);
  const [reviewBookingDetails, setReviewBookingDetails] = useState<any>(null);
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [checkingReviewStatus, setCheckingReviewStatus] = useState<boolean>(false);
  const [bookingQty, setBookingQty] = useState<number>(1);

  const fetchRealReviews = async () => {
    if (!id) return;
    try {
      setLoadingReviews(true);
      const res: any = await httpClient.get(`/reviews/item/${id}`);
      setRealReviews(res || []);
    } catch (e) {
      console.error("Lỗi tải đánh giá sản phẩm:", e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchReviewStatus = async () => {
    if (!id || !isAuthenticated) {
      setReviewStatus(null);
      return;
    }
    try {
      const res: any = await httpClient.get(`/reviews/my-status/${id}`);
      setReviewStatus(res);
    } catch (e) {
      // Nếu chưa đăng nhập hoặc lỗi, không hiển thị trạng thái
      setReviewStatus(null);
    }
  };

  useEffect(() => {
    fetchRealReviews();
  }, [id]);

  useEffect(() => {
    fetchReviewStatus();
  }, [id, isAuthenticated]);

  const reviewStats = React.useMemo(() => {
    const totalReviews = realReviews.length;
    if (totalReviews === 0) {
      return {
        averageRating: product?.rating?.averageRating || 0,
        totalReviews: product?.rating?.totalReviews || 0,
        breakdown: { 5: "0%", 4: "0%", 3: "0%", 2: "0%", 1: "0%" },
      };
    }
    const sum = realReviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = Math.round((sum / totalReviews) * 10) / 10;

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    realReviews.forEach((r) => {
      const star = Math.floor(r.rating) as 5 | 4 | 3 | 2 | 1;
      if (counts[star] !== undefined) {
        counts[star]++;
      }
    });

    const breakdown = {
      5: `${Math.round((counts[5] / totalReviews) * 100)}%`,
      4: `${Math.round((counts[4] / totalReviews) * 100)}%`,
      3: `${Math.round((counts[3] / totalReviews) * 100)}%`,
      2: `${Math.round((counts[2] / totalReviews) * 100)}%`,
      1: `${Math.round((counts[1] / totalReviews) * 100)}%`,
    };

    return {
      averageRating: avg,
      totalReviews,
      breakdown,
    };
  }, [realReviews, product]);

  // Sorted + filtered reviews
  const displayedReviews = React.useMemo(() => {
    let filtered = [...realReviews];
    if (reviewFilterHasImage) {
      filtered = filtered.filter((r) => r.images && r.images.length > 0);
    }
    if (reviewSortOrder === "newest") {
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
    } else if (reviewSortOrder === "highest") {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (reviewSortOrder === "lowest") {
      filtered.sort((a, b) => a.rating - b.rating);
    }
    return filtered;
  }, [realReviews, reviewSortOrder, reviewFilterHasImage]);

  const handleReportReview = async (reviewId: string) => {
    try {
      await httpClient.post(`/reviews/${reviewId}/report`, {
        reason: "Spam hoặc không phù hợp",
      });
      toast.success("Báo cáo đánh giá vi phạm thành công!");
    } catch (err: any) {
      toast.error("Báo cáo đánh giá thất bại");
    }
  };

  const handleWriteReviewClick = async () => {
    if (!isAuthenticated) {
      toast.error("Vui lòng đăng nhập để viết đánh giá.");
      navigate(ROUTES.LOGIN);
      return;
    }

    // Nếu đã có reviewStatus từ cache, dùng ngay
    if (reviewStatus) {
      if (reviewStatus.alreadyReviewed) {
        toast.success("Bạn đã gửi đánh giá cho sản phẩm này rồi. Cảm ơn bạn!");
        return;
      }
      if (!reviewStatus.hasCompletedBooking) {
        await Swal.fire({
          title: "Chưa có đơn thuê hoàn thành",
          html: `
            <div style="text-align:left;font-size:14px;line-height:1.6;color:#4B4540">
              <p>Để viết đánh giá, bạn cần hoàn thành ít nhất <strong>01 đơn thuê</strong> sản phẩm này.</p>
              <br/>
              <p>📌 <strong>Quy trình:</strong> Đặt lịch → Thanh toán → Nhà cung cấp xác nhận → Nhận đồ → Trả đồ → Hoàn thành → Viết đánh giá</p>
            </div>`,
          icon: "info",
          confirmButtonColor: "var(--color-primary-dark)",
          confirmButtonText: "Đặt lịch ngay",
          showCancelButton: true,
          cancelButtonText: "Đóng",
          background: "white",
        }).then((res) => {
          if (res.isConfirmed) {
            // Scroll lên phần đặt lịch
            document
              .getElementById("booking-section")
              ?.scrollIntoView({ behavior: "smooth" });
          }
        });
        return;
      }
      if (
        reviewStatus.canReview &&
        reviewStatus.bookingId &&
        reviewStatus.bookingItemId
      ) {
        setReviewBookingDetails({
          bookingId: reviewStatus.bookingId,
          bookingItemId: reviewStatus.bookingItemId,
        });
        setIsWriteReviewOpen(true);
        return;
      }
    }

    // Fallback: Gọi API check lại nếu chưa có reviewStatus
    setCheckingReviewStatus(true);
    try {
      const status: any = await httpClient.get(`/reviews/my-status/${id}`);
      setReviewStatus(status);

      if (status.alreadyReviewed) {
        toast.success("Bạn đã gửi đánh giá cho sản phẩm này rồi!");
        return;
      }

      if (!status.hasCompletedBooking) {
        await Swal.fire({
          title: "Chưa có đơn thuê hoàn thành",
          html: `
            <div style="text-align:left;font-size:14px;line-height:1.6;color:#4B4540">
              <p>Để viết đánh giá, bạn cần hoàn thành ít nhất <strong>01 đơn thuê</strong> sản phẩm này.</p>
              <br/>
              <p>📌 <strong>Quy trình:</strong> Đặt lịch → Thanh toán → Nhà cung cấp xác nhận → Nhận đồ → Trả đồ → Hoàn thành → Viết đánh giá</p>
            </div>`,
          icon: "info",
          confirmButtonColor: "var(--color-primary-dark)",
          confirmButtonText: "Đặt lịch ngay",
          showCancelButton: true,
          cancelButtonText: "Đóng",
          background: "white",
        }).then((res) => {
          if (res.isConfirmed) {
            document
              .getElementById("booking-section")
              ?.scrollIntoView({ behavior: "smooth" });
          }
        });
        return;
      }

      if (status.canReview && status.bookingId && status.bookingItemId) {
        setReviewBookingDetails({
          bookingId: status.bookingId,
          bookingItemId: status.bookingItemId,
        });
        setIsWriteReviewOpen(true);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi kiểm tra quyền đánh giá.");
    } finally {
      setCheckingReviewStatus(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBookingDetails) return;
    if (!writeComment.trim()) {
      toast.error("Vui lòng nhập nội dung đánh giá.");
      return;
    }

    setSubmittingReview(true);
    try {
      await httpClient.post("/reviews", {
        bookingId: reviewBookingDetails.bookingId,
        bookingItemId: reviewBookingDetails.bookingItemId,
        rating: writeRating,
        comment: writeComment.trim(),
        images: writeImages,
        productId: id,
      });

      toast.success(
        "Gửi đánh giá thành công! Cảm ơn bạn đã chia sẻ trải nghiệm.",
      );
      setIsWriteReviewOpen(false);
      setWriteComment("");
      setWriteRating(5);
      setWriteImages([]);
      setReviewBookingDetails(null);
      // Cập nhật lại trạng thái review và danh sách
      fetchRealReviews();
      fetchReviewStatus();
    } catch (err: any) {
      toast.error(err.message || "Gửi đánh giá thất bại. Vui lòng thử lại.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Selector choices
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");

  // Rental configuration: 'DAILY' | 'HOURLY'
  const [rentalMode, setRentalMode] = useState<"DAILY" | "HOURLY">("DAILY");

  // Date states
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [singleDate, setSingleDate] = useState<string>("");

  // Time states (for hourly rental)
  const [startTime, setStartTime] = useState<string>("07:00");
  const [endTime, setEndTime] = useState<string>("09:00");

  const availability = useProductAvailability({
    productId: product?._id,
    size: selectedSize, color: selectedColor,
    rentalFrom: rentalMode === 'DAILY' ? startDate : singleDate,
    rentalTo: rentalMode === 'DAILY' ? endDate : singleDate,
    quantity: bookingQty, rentalType: rentalMode,
    startTime: rentalMode === 'HOURLY' ? startTime : undefined,
    endTime: rentalMode === 'HOURLY' ? endTime : undefined,
  });
  const [busyDates, setBusyDates] = useState<string[]>([]);
  const [busySlots, setBusySlots] = useState<
    { date: string; timeSlot: string }[]
  >([]);

  const bookedSlotsOnSelectedDate = React.useMemo(() => {
    if (!singleDate) return [];
    return busySlots
      .filter((s) => s.date === singleDate)
      .map((s) => s.timeSlot);
  }, [singleDate, busySlots]);

  const isTimeSlotOverlap = (slot1: string, slot2: string) => {
    const parseTime = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const [start1Str, end1Str] = slot1.split("-").map((s) => s.trim());
    const [start2Str, end2Str] = slot2.split("-").map((s) => s.trim());
    if (!start1Str || !end1Str || !start2Str || !end2Str) return false;
    const s1 = parseTime(start1Str);
    const e1 = parseTime(end1Str);
    const s2 = parseTime(start2Str);
    const e2 = parseTime(end2Str);
    return s1 < e2 && s2 < e1;
  };

  // Interactive UI modals
  const [isAiStylingOpen, setIsAiStylingOpen] = useState<boolean>(false);
  const [isAiSizeOpen, setIsAiSizeOpen] = useState<boolean>(false);
  const [isComboOpen, setIsComboOpen] = useState<boolean>(false);

  // AI Size Form States
  const [aiHeight, setAiHeight] = useState<number | "">(160);
  const [aiWeight, setAiWeight] = useState<number | "">(50);
  const [aiChest, setAiChest] = useState<number | "">(84);
  const [aiWaist, setAiWaist] = useState<number | "">(66);
  const [aiFitPref, setAiFitPref] = useState<"SLIM" | "COMFORT">("COMFORT");
  const [aiResultSize, setAiResultSize] = useState<string>("");
  const [aiReason, setAiReason] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  const calculateSizeLocally = (
    h: number,
    w: number,
    c: number,
    e: number,
    fit: "SLIM" | "COMFORT",
  ): string => {
    if (w > 85 || e > 95) {
      return "CUSTOM";
    }

    let sizeH = "XS";
    if (h < 150) sizeH = "XS";
    else if (h < 155) sizeH = "S";
    else if (h < 162) sizeH = "M";
    else if (h < 168) sizeH = "L";
    else if (h < 173) sizeH = "XL";
    else sizeH = "XXL";

    let sizeW = "XS";
    if (w < 43) sizeW = "XS";
    else if (w < 48) sizeW = "S";
    else if (w < 54) sizeW = "M";
    else if (w < 60) sizeW = "L";
    else if (w < 68) sizeW = "XL";
    else sizeW = "XXL";

    let sizeC = "XS";
    if (c <= 81) sizeC = "XS";
    else if (c <= 85) sizeC = "S";
    else if (c <= 89) sizeC = "M";
    else if (c <= 93) sizeC = "L";
    else if (c <= 97) sizeC = "XL";
    else sizeC = "XXL";

    let sizeE = "XS";
    if (e <= 63) sizeE = "XS";
    else if (e <= 67) sizeE = "S";
    else if (e <= 71) sizeE = "M";
    else if (e <= 75) sizeE = "L";
    else if (e <= 79) sizeE = "XL";
    else sizeE = "XXL";

    const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL"];
    const idxH = sizeOrder.indexOf(sizeH);
    const idxW = sizeOrder.indexOf(sizeW);
    const idxC = sizeOrder.indexOf(sizeC);
    const idxE = sizeOrder.indexOf(sizeE);

    let maxIdx = Math.max(idxH, idxW, idxC, idxE);
    if (fit === "COMFORT") {
      maxIdx = maxIdx + 1;
    }

    if (maxIdx >= sizeOrder.length) {
      return "CUSTOM";
    }

    const calculatedSize = sizeOrder[maxIdx];
    const sizesList = product?.sizes || ["S", "M", "L"];

    if (sizesList.includes(calculatedSize)) {
      return calculatedSize;
    }

    const validSizes = sizesList.filter((s) => sizeOrder.includes(s));
    if (validSizes.length === 0) {
      return "CUSTOM";
    }

    const availableIndices = validSizes.map((s) => sizeOrder.indexOf(s));
    const maxAvailableIdx = Math.max(...availableIndices);
    const minAvailableIdx = Math.min(...availableIndices);

    if (maxIdx > maxAvailableIdx) {
      return "CUSTOM";
    }

    if (maxIdx < minAvailableIdx) {
      return sizeOrder[minAvailableIdx];
    }

    const fitIndices = availableIndices.filter((idx) => idx >= maxIdx);
    if (fitIndices.length > 0) {
      const nextSizeIdx = Math.min(...fitIndices);
      return sizeOrder[nextSizeIdx];
    }

    return "CUSTOM";
  };

  const handleAiSizeCalculation = async () => {
    // Normalization of values
    const h = Math.max(100, Math.min(250, Number(aiHeight) || 160));
    const w = Math.max(20, Math.min(200, Number(aiWeight) || 50));
    const c = Math.max(40, Math.min(150, Number(aiChest) || 84));
    const e = Math.max(30, Math.min(150, Number(aiWaist) || 66));

    // Update UI states to display sanitised values
    setAiHeight(h);
    setAiWeight(w);
    setAiChest(c);
    setAiWaist(e);

    setIsAiLoading(true);
    setAiResultSize("");
    setAiReason("");

    const computedSize = calculateSizeLocally(h, w, c, e, aiFitPref);

    try {
      let prompt = "";
      if (computedSize === "CUSTOM") {
        prompt = `Tôi muốn thuê áo dài "${product?.name}". Số đo: cao ${h}cm, nặng ${w}kg, vòng eo ${e}cm, vòng ngực ${c}cm. Tôi thích mặc kiểu ${aiFitPref === "SLIM" ? "ôm sát tôn dáng" : "rộng rãi thoải mái"}. Số đo này vượt quá bảng size may sẵn tiêu chuẩn hoặc vượt quá các size hiện có của sản phẩm này (${product?.sizes?.join(", ") || "S, M, L"}). Hãy tư vấn cho tôi lý do tôi cần liên hệ trực tiếp với cửa hàng để được đặt may đo hoặc chỉnh sửa theo số đo cơ thể, và khuyên tôi không nên thuê các size may sẵn hiện có. Hãy trả lời ngắn gọn trong 2-3 câu.`;
      } else {
        prompt = `Tôi muốn thuê áo dài "${product?.name}". Số đo: cao ${h}cm, nặng ${w}kg, vòng eo ${e}cm, vòng ngực ${c}cm. Tôi thích mặc kiểu ${aiFitPref === "SLIM" ? "ôm sát tôn dáng" : "rộng rãi thoải mái"}. Hãy tư vấn xem tôi nên chọn size nào trong các size khả dụng: ${product?.sizes?.join(", ") || "S, M, L"}. Hãy khuyên dùng size ${computedSize} và giải thích lý do cụ thể trong 2-3 câu ngắn gọn.`;
      }

      const response: any = await httpClient.post("/ai/chat", {
        message: prompt,
      });

      setAiResultSize(computedSize);
      if (computedSize === "CUSTOM") {
        setAiReason(
          response.answer ||
            `Số đo bạn nhập (cân nặng ${w}kg, vòng eo ${e}cm) vượt quá bảng size may sẵn tiêu chuẩn của áo dài này. Chúng tôi khuyên bạn nên liên hệ trực tiếp với VibeHue để đặt may hoặc chỉnh sửa số đo riêng nhằm đảm bảo sự vừa vặn và thoải mái cao nhất.`,
        );
      } else {
        setAiReason(
          response.answer ||
            `Dựa trên số đo chiều cao ${h}cm và cân nặng ${w}kg, kích cỡ tối ưu cho bạn là Size ${computedSize}. Size này sẽ giúp bạn thoải mái cử động và giữ phom dáng áo đẹp nhất.`,
        );
      }
    } catch (error) {
      console.error("Lỗi khi gọi AI tư vấn size:", error);
      setAiResultSize(computedSize);
      if (computedSize === "CUSTOM") {
        setAiReason(
          `Số đo bạn nhập (cân nặng ${w}kg, vòng eo ${e}cm) vượt quá bảng size may sẵn tiêu chuẩn của áo dài này. Chúng tôi khuyên bạn nên liên hệ trực tiếp với VibeHue để đặt may hoặc chỉnh sửa số đo riêng nhằm đảm bảo sự vừa vặn và thoải mái cao nhất.`,
        );
      } else {
        setAiReason(
          `Dựa trên phân tích số đo chiều cao ${h}cm, cân nặng ${w}kg và sở thích mặc của bạn, chuyên gia khuyên dùng Size ${computedSize} để ôm vừa vặn vòng eo ${e}cm của bạn.`,
        );
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  // Description Tabs: 'details' | 'policies' | 'guide'
  const [activeInfoTab, setActiveInfoTab] = useState<
    "details" | "policies" | "guide"
  >("details");

  // Favorites state
  const [isFav, setIsFav] = useState<boolean>(false);

  useEffect(() => {
    if (user?.favorites && id) {
      const isFavorited = user.favorites.some(
        (f: any) =>
          (f.targetType === "PRODUCT" || f.targetType === "Product") &&
          f.targetId.toString() === id.toString(),
      );
      setIsFav(isFavorited);
    } else {
      setIsFav(false);
    }
  }, [user, id]);

  const handleToggleFavorite = async () => {
    if (!user) {
      Swal.fire({
        icon: "warning",
        title: "Yêu cầu đăng nhập",
        text: "Vui lòng đăng nhập để lưu sản phẩm yêu thích!",
        confirmButtonColor: "var(--color-primary)",
        confirmButtonText: "Đăng nhập ngay",
        showCancelButton: true,
        cancelButtonText: "Hủy",
      }).then((result) => {
        if (result.isConfirmed) {
          navigate("/login");
        }
      });
      return;
    }
    try {
      await apiToggleFavorite("PRODUCT", id!);
      if (isFav) {
        toast.success("Đã xóa khỏi danh sách yêu thích!");
      } else {
        toast.success("Đã thêm vào danh sách yêu thích!");
      }
    } catch (err) {
      console.error("Lỗi khi lưu yêu thích:", err);
      toast.error("Không thể cập nhật danh sách yêu thích.");
    }
  };

  const [suggestedPhotographers, setSuggestedPhotographers] = useState<any[]>(
    [],
  );

  // Calendar states
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const calendarDays = React.useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfWeek = new Date(year, month, 1).getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: any[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        day: 0,
        dateStr: "",
        isWeekend: false,
        isAvailable: false,
        isEmpty: true,
      });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const dayOfWeek = new Date(dateStr).getDay();

      let isAvailable = !busyDates.includes(dateStr) && dateStr >= todayStr;
      if (rentalMode === "HOURLY" && dateStr === todayStr) {
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const hasTimeSlotsLeft = productSlots.some((block) => {
          const [h, m] = block.start.split(":").map(Number);
          return h > currentHour || (h === currentHour && m > currentMinute);
        });
        isAvailable = isAvailable && hasTimeSlotsLeft;
      }

      days.push({
        day: i,
        dateStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isAvailable,
        isEmpty: false,
      });
    }
    return days;
  }, [calendarDate, busyDates, rentalMode]);

  const startSlotIndex = React.useMemo(() => {
    return productSlots.findIndex((s) => s.start === startTime);
  }, [startTime]);

  const endSlotIndex = React.useMemo(() => {
    return productSlots.findIndex((s) => s.end === endTime);
  }, [endTime]);

  // Reset and auto-select first available slot when date changes
  useEffect(() => {
    if (rentalMode !== "HOURLY" || !singleDate) {
      return;
    }
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Find first available slot
    const firstAvailableIndex = productSlots.findIndex((block) => {
      const isBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
        isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot),
      );
      const isPast =
        singleDate === todayStr &&
        (() => {
          const [sh, sm] = block.start.split(":").map(Number);
          return (
            sh < today.getHours() ||
            (sh === today.getHours() && sm <= today.getMinutes())
          );
        })();
      return !isBusy && !isPast;
    });

    if (firstAvailableIndex !== -1) {
      setStartTime(productSlots[firstAvailableIndex].start);
      setEndTime(productSlots[firstAvailableIndex].end);
    }
  }, [singleDate, bookedSlotsOnSelectedDate, rentalMode]);

  const handleSlotClick = (i: number) => {
    const block = productSlots[i];

    // Check if busy or past
    const isBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
      isTimeSlotOverlap(`${block.start}-${block.end}`, bookedSlot),
    );
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const isPast =
      singleDate === todayStr &&
      (() => {
        const [sh, sm] = block.start.split(":").map(Number);
        return (
          sh < today.getHours() ||
          (sh === today.getHours() && sm <= today.getMinutes())
        );
      })();

    if (isBusy || isPast) return;

    const currentStartIdx = productSlots.findIndex(
      (s) => s.start === startTime,
    );
    const currentEndIdx = productSlots.findIndex((s) => s.end === endTime);

    if (
      currentStartIdx === -1 ||
      currentStartIdx !== currentEndIdx ||
      i < currentStartIdx
    ) {
      setStartTime(block.start);
      setEndTime(block.end);
    } else {
      let hasBusyOrPastInRange = false;
      for (let idx = currentStartIdx; idx <= i; idx++) {
        const checkBlock = productSlots[idx];
        const checkBusy = bookedSlotsOnSelectedDate.some((bookedSlot) =>
          isTimeSlotOverlap(
            `${checkBlock.start}-${checkBlock.end}`,
            bookedSlot,
          ),
        );
        const checkPast =
          singleDate === todayStr &&
          (() => {
            const [sh, sm] = checkBlock.start.split(":").map(Number);
            return (
              sh < today.getHours() ||
              (sh === today.getHours() && sm <= today.getMinutes())
            );
          })();
        if (checkBusy || checkPast) {
          hasBusyOrPastInRange = true;
          break;
        }
      }

      if (hasBusyOrPastInRange) {
        toast.error("Khoảng thời gian chọn chứa khung giờ đã bận hoặc đã qua!");
        setStartTime(block.start);
        setEndTime(block.end);
      } else {
        setEndTime(block.end);
      }
    }
  };

  const selectedTimeSlot = `${startTime}-${endTime}`;

  const isCurrentTimeSlotBusy = React.useMemo(() => {
    if (rentalMode !== "HOURLY") return false;
    return bookedSlotsOnSelectedDate.some((bookedSlot) => {
      if (!bookedSlot) return false;
      return isTimeSlotOverlap(selectedTimeSlot, bookedSlot);
    });
  }, [rentalMode, selectedTimeSlot, bookedSlotsOnSelectedDate]);

  const handleCalendarDayClick = (dateStr: string) => {
    if (rentalMode === "HOURLY") {
      setSingleDate(dateStr);
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else {
      // DAILY range selection
      if (busyDates.includes(dateStr)) {
        toast.error("Ngày này đã bị đặt lịch!");
        return;
      }
      if (!startDate || (startDate && endDate)) {
        setStartDate(dateStr);
        setEndDate("");
      } else {
        if (dateStr < startDate) {
          setStartDate(dateStr);
          setEndDate("");
        } else {
          // Check if there are any unavailable dates in the selected range!
          const hasUnavailable = calendarDays.some(
            (d) =>
              !d.isEmpty &&
              !d.isAvailable &&
              d.dateStr >= startDate &&
              d.dateStr <= dateStr,
          );
          if (hasUnavailable) {
            toast.error("Khoảng thời gian chọn chứa ngày đã bị đặt!");
            return;
          }
          setEndDate(dateStr);
        }
      }
    }
  };

  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await httpClient.get<any>(`/products/${id}`);
        setProduct(data);
        // Ghi nhận lượt xem sản phẩm (fire-and-forget)
        void httpClient.post(`/analytics/products/${id}/view`, {}).catch(() => {});

        // Load busy dates/slots
        let loadedBookedDates: string[] = [];
        try {
          const busyData = await httpClient.get<{
            bookedDates: string[];
            bookedSlots: { date: string; timeSlot: string }[];
          }>(`/api/bookings/busy-dates/product/${id}`);
          loadedBookedDates = busyData.bookedDates || [];
          setBusyDates(loadedBookedDates);
          setBusySlots(busyData.bookedSlots || []);
        } catch (e) {
          console.error("Lỗi tải lịch bận của sản phẩm:", e);
        }
        if (data.images && data.images.length > 0) {
          setActiveImage(data.images[0]);
        }
        if (data.colors && data.colors.length > 0) {
          setSelectedColor(data.colors[0]);
        }
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
          try {
            const user = await httpClient.get<any>("/users/me");
            if (
              user?.hasCompletedOnboarding &&
              user?.preferences?.sizeInfo?.preferredSize
            ) {
              const preferred =
                user.preferences.sizeInfo.preferredSize.toUpperCase();
              const matchedSize = data.sizes.find(
                (s: string) => s.toUpperCase() === preferred,
              );
              if (matchedSize) {
                setSelectedSize(matchedSize);
              }
            }
          } catch (e) {
            console.log(
              "Not logged in or failed to fetch profile for pre-selection:",
              e,
            );
          }
        }
        // Tìm 3 ngày liên tiếp khả dụng đầu tiên bắt đầu từ ngày mai
        let foundRange = false;
        let startDateVal = "";
        let endDateVal = "";
        const maxSearchDays = 60; // Tìm tối đa trong vòng 60 ngày tới

        for (let offset = 0; offset < maxSearchDays; offset++) {
          const checkStart = new Date();
          checkStart.setDate(checkStart.getDate() + 1 + offset);
          const startStr = checkStart.toISOString().split("T")[0];

          const checkEnd = new Date(checkStart);
          checkEnd.setDate(checkEnd.getDate() + 2); // Rent range: 3 days (e.g. 6 to 8)
          const endStr = checkEnd.toISOString().split("T")[0];

          let hasBusy = false;
          const temp = new Date(checkStart);
          while (temp <= checkEnd) {
            const tempStr = temp.toISOString().split("T")[0];
            if (loadedBookedDates.includes(tempStr)) {
              hasBusy = true;
              break;
            }
            temp.setDate(temp.getDate() + 1);
          }

          if (!hasBusy) {
            startDateVal = startStr;
            endDateVal = endStr;
            foundRange = true;
            break;
          }
        }

        if (foundRange) {
          setStartDate(startDateVal);
          setEndDate(endDateVal);
          setSingleDate(startDateVal);
        } else {
          // Fallback tìm 1 ngày rảnh duy nhất
          let fallbackStart = new Date();
          fallbackStart.setDate(fallbackStart.getDate() + 1);
          let foundFallback = false;
          for (let offset = 0; offset < maxSearchDays; offset++) {
            const checkStart = new Date();
            checkStart.setDate(checkStart.getDate() + 1 + offset);
            const startStr = checkStart.toISOString().split("T")[0];
            if (!loadedBookedDates.includes(startStr)) {
              setStartDate(startStr);
              setEndDate(startStr);
              setSingleDate(startStr);
              foundFallback = true;
              break;
            }
          }
          if (!foundFallback) {
            // Cực hạn fallback: gán đại ngày mai
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const nextDay = new Date();
            nextDay.setDate(nextDay.getDate() + 3);
            setStartDate(tomorrow.toISOString().split("T")[0]);
            setEndDate(nextDay.toISOString().split("T")[0]);
            setSingleDate(tomorrow.toISOString().split("T")[0]);
          }
        }
      } catch (err: any) {
        console.error("Lỗi lấy chi tiết sản phẩm:", err);
        setError(err.message || "Không thể lấy thông tin sản phẩm.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const fetchSuggestions = async () => {
      try {
        const data = await httpClient.get<any[]>("/api/photographers");
        const productCity =
          product.providerId?.address?.city || "Thừa Thiên Huế";

        // Filter photographers by matching city
        const filtered = data.filter((prov: any) => {
          const provCity = prov.address?.city || "";
          const normalize = (s: string) =>
            s
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim();
          return (
            normalize(provCity).includes(normalize(productCity)) ||
            normalize(productCity).includes(normalize(provCity))
          );
        });

        // Use filtered or fallback to original data if filtered is empty
        const listToMap = filtered.length > 0 ? filtered : data;

        const mapped = listToMap.slice(0, 3).map((prov: any) => {
          const rawName = prov.businessName || "Nhiếp ảnh gia";
          let displayName = rawName;
          let quote = "Chuyên chụp cổ phục ngoại cảnh Đại Nội Huế";
          let avatar = "/hoang_minh.png";

          if (rawName.includes("Minh Trí") || rawName.includes("Hoàng Minh")) {
            displayName = "Hoàng Minh";
            quote =
              "Phong cách nghệ thuật hoài cổ. Concept Mộng Thơ sẽ phù hợp với thiết kế này.";
            avatar = "/hoang_minh.png";
          } else if (
            rawName.includes("Hoàng Lê") ||
            rawName.includes("Lê Thảo")
          ) {
            displayName = "Lê Thảo";
            quote =
              "Phong cách thơ mộng, ánh sáng tự nhiên, tôn nét dịu dàng của tà áo dài truyền thống.";
            avatar = "/le_thao.png";
          } else if (
            rawName.includes("Thanh Thủy") ||
            rawName.includes("Trần Bảo")
          ) {
            displayName = "Trần Bảo";
            quote =
              "Kể chuyện cổ phục bằng ngôn ngữ điện ảnh, tạo góc máy thần thái đạt chất lượng cao.";
            avatar = "/tran_bao.png";
          } else {
            avatar = prov.portfolio?.[0] || "/hoang_minh.png";
          }

          const minPrice =
            prov.packages && prov.packages.length > 0
              ? Math.min(...prov.packages.map((p: any) => p.price))
              : 1500000;

          return {
            id: prov._id,
            name: displayName,
            rating: prov.rating?.averageRating || 5.0,
            count: prov.rating?.totalReviews || 12,
            desc: quote,
            price: `${minPrice.toLocaleString("vi-VN")}đ`,
            image: avatar,
          };
        });

        if (mapped.length < 3) {
          const fallbacks = [
            {
              id: "p1",
              name: "Hoàng Minh",
              rating: 4.9,
              count: 142,
              desc: "Phong cách nghệ thuật hoài cổ. Concept Mộng Thơ sẽ phù hợp với thiết kế này.",
              price: "1.500.000đ",
              image: "/hoang_minh.png",
            },
            {
              id: "p2",
              name: "Lê Thảo",
              rating: 5.0,
              count: 96,
              desc: "Phong cách thơ mộng, ánh sáng tự nhiên, tôn nét dịu dàng của tà áo dài truyền thống.",
              price: "2.000.000đ",
              image: "/le_thao.png",
            },
            {
              id: "p3",
              name: "Trần Bảo",
              rating: 4.8,
              count: 75,
              desc: "Kể chuyện cổ phục bằng ngôn ngữ điện ảnh, tạo góc máy thần thái đạt chất lượng cao.",
              price: "2.500.000đ",
              image: "/tran_bao.png",
            },
          ];
          const combined = [...mapped, ...fallbacks.slice(mapped.length)];
          setSuggestedPhotographers(combined);
        } else {
          setSuggestedPhotographers(mapped);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách thợ gợi ý:", err);
        setSuggestedPhotographers([
          {
            id: "p1",
            name: "Hoàng Minh",
            rating: 4.9,
            count: 142,
            desc: "Phong cách nghệ thuật hoài cổ. Concept Mộng Thơ sẽ phù hợp với thiết kế này.",
            price: "1.500.000đ",
            image: "/hoang_minh.png",
          },
          {
            id: "p2",
            name: "Lê Thảo",
            rating: 5.0,
            count: 96,
            desc: "Phong cách thơ mộng, ánh sáng tự nhiên, tôn nét dịu dàng của tà áo dài truyền thống.",
            price: "2.000.000đ",
            image: "/le_thao.png",
          },
          {
            id: "p3",
            name: "Trần Bảo",
            rating: 4.8,
            count: 75,
            desc: "Kể chuyện cổ phục bằng ngôn ngữ điện ảnh, tạo góc máy thần thái đạt chất lượng cao.",
            price: "2.500.000đ",
            image: "/tran_bao.png",
          },
        ]);
      }
    };

    fetchSuggestions();
  }, [product]);

  // Handle hourly time validation rules
  useEffect(() => {
    if (rentalMode === "HOURLY") {
      const startIndex = timeSlots.indexOf(startTime);
      const endIndex = timeSlots.indexOf(endTime);

      // Calculate minimum end time index (2 hours difference = 4 slots of 30 minutes)
      const minEndIndex = startIndex + 4;

      if (endIndex < minEndIndex && startIndex !== -1) {
        // Automatically set valid end time if currently invalid
        const targetEndIndex = Math.min(minEndIndex, timeSlots.length - 1);
        setEndTime(timeSlots[targetEndIndex]);
      }
    }
  }, [startTime, rentalMode]);

  // Sizing mapping helper
  const translateColorHex = (colorName: string): string => {
    const catalog: Record<string, string> = {
      RED: "#A11E22",
      WHITE: "#FFFFFF",
      GOLD: "#E6C280",
      GREEN: "#2E5A44",
      GREY: "#8E8E93",
      BLACK: "#1A1A1A",
      BLUE: "#2980B9",
      PINK: "#F1948A",
      YELLOW: "#F4D03F",
    };
    return catalog[colorName.toUpperCase()] || "#CCCCCC";
  };

  const formatSingleDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    if (dateStr.includes("/")) return dateStr;
    return dateStr;
  };

  const getDayDuration = () => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const getHourDuration = () => {
    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);
    if (startIndex === -1 || endIndex === -1) return 2;
    return (endIndex - startIndex) * 0.5;
  };

  const getDisplayPrice = (): string => {
    if (!product) return '0đ';
    const base = product.activeCampaign && product.discountedPrice ? product.discountedPrice : product.basePrice;
    if (rentalMode === 'DAILY') {
      const days = getDayDuration();
      const priceVal = base * days;
      return `${priceVal.toLocaleString('vi-VN')}đ / ${days} ngày`;
    } else {
      const hours = getHourDuration();
      const hourlyRate = product.hourlyPrice || Math.round(base * 0.3) || 80000;
      const priceVal = hourlyRate * hours;
      return `${priceVal.toLocaleString("vi-VN")}đ / ${hours} giờ`;
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.error("Vui lòng đăng nhập để thực hiện chức năng này.");
      navigate(ROUTES.LOGIN);
      return;
    }

    if (!selectedSize || !selectedColor) {
      toast.error("Vui lòng chọn đầy đủ màu sắc và kích cỡ.");
      return;
    }
    const rentalFrom = rentalMode === 'DAILY' ? startDate : singleDate;
    const rentalTo = rentalMode === 'DAILY' ? endDate : singleDate;
    try {
      const availability = await checkProductAvailability(product?._id || '', selectedSize, selectedColor, rentalFrom, rentalTo, bookingQty, rentalMode, rentalMode === 'HOURLY' ? startTime : undefined, rentalMode === 'HOURLY' ? endTime : undefined);
      if (!availability.available) { toast.error(`Ch? c?n ${availability.availableQuantity} s?n ph?m ph? h?p trong l?ch ?? ch?n.`); return; }
    } catch (error: any) { toast.error(error.message || 'Kh?ng th? ki?m tra l?ch thu?.'); return; }


    const days = getDayDuration();
    const hours = getHourDuration();
    const base = product?.activeCampaign && product?.discountedPrice ? product.discountedPrice : (product?.basePrice || 0);
    const hourlyRate = product?.hourlyPrice || Math.round(base * 0.3) || 80000;
    const computedPrice = rentalMode === 'DAILY' ? base * days : hourlyRate * hours;

    const cartPayload = {
      itemType: "PRODUCT" as const,
      productId: product?._id,
      name: product?.name,
      image:
        product?.images?.[0] ||
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b",
      basePrice: computedPrice,
      depositAmount: product?.depositAmount,
      size: selectedSize,
      color: selectedColor,
      rentalType: rentalMode,
      startDate: rentalMode === "DAILY" ? startDate : singleDate,
      endDate: rentalMode === "DAILY" ? endDate : singleDate,
      startTime: rentalMode === "HOURLY" ? startTime : undefined,
      endTime: rentalMode === "HOURLY" ? endTime : undefined,
      providerCity: product?.providerId?.address?.city || "Thừa Thiên Huế",
      providerAddress: product?.providerId?.address?.addressLine || "",
      comboDiscountPercent: (product?.providerId as any)?.comboDiscountPercent,
      quantity: bookingQty,
    };

    addToCart(cartPayload);
    toast.success("Đã thêm sản phẩm áo dài vào giỏ hàng thành công!");
  };

  const handleBookingSubmit = async () => {
    if (!isAuthenticated) {
      toast.error("Vui lòng đăng nhập để thực hiện chức năng này.");
      navigate(ROUTES.LOGIN);
      return;
    }

    if (!selectedSize || !selectedColor) {
      toast.error("Vui lòng chọn đầy đủ màu sắc và kích cỡ.");
      return;
    }

    const days = getDayDuration();
    const hours = getHourDuration();
    const baseForBooking = product?.activeCampaign && product?.discountedPrice ? product.discountedPrice : (product?.basePrice || 0);
    const hourlyRate = product?.hourlyPrice || Math.round(baseForBooking * 0.3) || 80000;
    const computedPrice = rentalMode === 'DAILY' ? baseForBooking * days : hourlyRate * hours;

    const cartPayload = {
      itemType: "PRODUCT" as const,
      productId: product?._id,
      name: product?.name,
      image:
        product?.images?.[0] ||
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b",
      basePrice: computedPrice,
      depositAmount: product?.depositAmount,
      size: selectedSize,
      color: selectedColor,
      rentalType: rentalMode,
      startDate: rentalMode === "DAILY" ? startDate : singleDate,
      endDate: rentalMode === "DAILY" ? endDate : singleDate,
      startTime: rentalMode === "HOURLY" ? startTime : undefined,
      endTime: rentalMode === "HOURLY" ? endTime : undefined,
      providerCity: product?.providerId?.address?.city || "Thừa Thiên Huế",
      providerAddress: product?.providerId?.address?.addressLine || "",
      comboDiscountPercent: (product?.providerId as any)?.comboDiscountPercent,
      quantity: bookingQty,
    };

    addToCart(cartPayload);
    toast.success("Đã thêm sản phẩm áo dài vào giỏ hàng!");
    navigate(ROUTES.CART);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
          gap: "16px",
        }}
      >
        <div className="vh-loading-spinner">
          <div className="vh-loading-double-bounce1"></div>
          <div className="vh-loading-double-bounce2"></div>
        </div>
        <span className="font-header text-stone-600">
          Đang tải chi tiết áo dài...
        </span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-20 text-center">
        <h3 className="text-2xl font-bold font-header text-stone-800">
          Đã xảy ra lỗi
        </h3>
        <p className="text-stone-500 mt-2">
          {error || "Không tìm thấy sản phẩm."}
        </p>
        <button
          className="vh-btn vh-btn-primary mt-6"
          onClick={() => navigate(ROUTES.RENTALS)}
        >
          QUAY LẠI TRANG CHỦ
        </button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#FCF9F2', minHeight: '100vh', padding: '40px 0' }}>
      {product.activeCampaign && (
        <div style={{ maxWidth: '1200px', margin: '0 auto 24px auto', padding: '0 40px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '14px 20px', borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
            color: 'white', boxShadow: '0 10px 24px -8px rgba(139,20,20,0.45)',
          }}>
            <div style={{
              flexShrink: 0, width: '48px', height: '48px', borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em',
            }}>
              -{product.activeCampaign.discountPercent}%
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>
                Ưu đãi {product.activeCampaign.occasion} · Giảm {product.activeCampaign.discountPercent}%
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 500, opacity: 0.92, marginTop: '2px' }}>
                Áp dụng đến hết ngày {new Date(product.activeCampaign.endDate).toLocaleDateString('vi-VN')} — đặt ngay kẻo lỡ!
              </div>
            </div>
            <span style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: '999px', backgroundColor: 'white',
              color: 'var(--color-primary-dark)', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap',
              letterSpacing: '0.03em',
            }}>
              ĐANG DIỄN RA
            </span>
          </div>
        </div>
      )}      <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '0 40px' }}>
        
        {/* BREADCRUMB */}
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            color: "#78716c",
            fontSize: "14px",
            fontWeight: 500,
            marginBottom: "32px",
          }}
        >
          <span style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
            Trang chủ
          </span>
          <ChevronRight size={14} style={{ color: "#a8a29e" }} />
          <span
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/rentals")}
          >
            Bộ sưu tập áo dài
          </span>
          <ChevronRight size={14} style={{ color: "#a8a29e" }} />
          <span style={{ color: "#1c1917", fontWeight: 600 }}>
            {product.name}
          </span>
        </nav>

        {/* MAIN SPLIT CONTENT */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
            gap: "60px",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN: Gallery */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              position: "sticky",
              top: "112px",
            }}
          >
            {/* Thumbnails list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                flexShrink: 0,
              }}
            >
              {(product.images.length > 0
                ? product.images
                : [
                    "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b",
                    "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f",
                    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f",
                  ]
              ).map((img, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(img)}
                  style={{
                    width: "72px",
                    height: "90px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border:
                      activeImage === img
                        ? "2px solid var(--color-primary)"
                        : "1px solid rgba(0,0,0,0.1)",
                    boxShadow:
                      activeImage === img ? "var(--shadow-sm)" : "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    padding: 0,
                  }}
                >
                  <img
                    src={getImageUrl(img)}
                    alt={`${product.name} thumbnail ${index}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Main Image View */}
            <div
              style={{
                flex: 1,
                height: "580px",
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid var(--color-light-border)",
                position: "relative",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <img
                src={getImageUrl(activeImage)}
                alt={product.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />

              {/* Premium Badge */}
              <span
                style={{
                  position: "absolute",
                  top: "20px",
                  left: "20px",
                  padding: "6px 14px",
                  borderRadius: "9999px",
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
              >
                CHO THUÊ
              </span>

              {/* Heart floating action */}
              <button
                onClick={handleToggleFavorite}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow-md)",
                  cursor: "pointer",
                  color: isFav
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                  transition: "all 0.2s ease",
                }}
              >
                <Heart size={18} fill={isFav ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Details & Config */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "28px" }}
          >
            {/* Header info */}
            <div>
              <span
                className="font-header"
                style={{
                  color: "var(--color-gold)",
                  fontWeight: 700,
                  fontSize: "14px",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Hãng: {product.providerId?.businessName || "Huế Cổ Phục Studio"}
              </span>
              <h1 className="font-header text-4xl text-stone-900 font-bold mt-1 leading-tight">
                {product.name}
              </h1>

              <div style={{ marginTop: "10px" }}>
                <SmartTagList badges={product.badges} />
              </div>

              {/* Star rating summary */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "2px",
                    color: "var(--color-gold)",
                  }}
                >
                  {[1, 2, 3, 4, 5].map((starIdx) => (
                    <Star
                      key={starIdx}
                      size={14}
                      fill={
                        starIdx <= Math.round(product.rating.averageRating)
                          ? "currentColor"
                          : "none"
                      }
                      color="currentColor"
                    />
                  ))}
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {product.rating.averageRating.toFixed(1)}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  ({product.rating.totalReviews} đánh giá)
                </span>
              </div>
            </div>

            {/* Price section */}
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid var(--color-light-border)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
              >
                GIÁ THUÊ TẠM TÍNH
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "8px",
                  marginTop: "4px",
                }}
              >
                <span
                  className="font-header"
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "var(--color-primary-dark)",
                  }}
                >
                  {getDisplayPrice()}
                </span>
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Shield size={13} className="text-emerald-600" />
                <span>
                  Tiền cọc đảm bảo hoàn trả:{" "}
                  <strong>
                    {product.depositAmount.toLocaleString("vi-VN")}đ
                  </strong>
                </span>
              </p>
            </div>

            {/* Pickup Address Section */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                backgroundColor: "#F5F2EB",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid rgba(182, 145, 91, 0.2)",
              }}
            >
              <MapPin
                size={20}
                style={{
                  color: "var(--color-primary-dark)",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              />
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--color-text-secondary)",
                    fontWeight: 700,
                    display: "block",
                    textTransform: "uppercase",
                  }}
                >
                  Địa chỉ nhận đồ (Lấy tại cửa hàng)
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    display: "block",
                    marginTop: "2px",
                  }}
                >
                  {product.providerId?.address
                    ? `${product.providerId.address.addressLine}, ${product.providerId.address.ward ? product.providerId.address.ward + ", " : ""}${product.providerId.address.district ? product.providerId.address.district + ", " : ""}${product.providerId.address.city || ""}`
                    : "45 Lê Lợi, Phú Hội, Thành phố Huế, Thừa Thiên Huế"}
                </span>
                {product.providerId?.contact?.phone && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--color-text-secondary)",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    SĐT liên hệ:{" "}
                    <strong>{product.providerId.contact.phone}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* AI Assistance Widget */}
            <div
              style={{
                border: "1px solid rgba(182, 145, 91, 0.3)",
                borderRadius: "16px",
                padding: "20px",
                backgroundColor: "rgba(252, 249, 242, 0.7)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-gold-dark)",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Sparkles size={12} /> CÔNG NGHỆ AI HỖ TRỢ
              </span>
              <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
                <button
                  onClick={() => setIsAiStylingOpen(true)}
                  style={{
                    flex: 1,
                    backgroundColor: "white",
                    border: "1px solid rgba(182, 145, 91, 0.25)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-sm)",
                    transition: "transform 0.2s ease",
                  }}
                  className="hover:scale-[1.02]"
                >
                  <Sparkles
                    size={18}
                    className="text-amber-500 animate-pulse"
                  />
                  <span
                    className="font-header font-bold text-stone-800"
                    style={{ fontSize: "13px" }}
                  >
                    Thử Đồ Ảo (AI)
                  </span>
                </button>
                <button
                  onClick={() => setIsAiSizeOpen(true)}
                  style={{
                    flex: 1,
                    backgroundColor: "white",
                    border: "1px solid rgba(182, 145, 91, 0.25)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-sm)",
                    transition: "transform 0.2s ease",
                  }}
                  className="hover:scale-[1.02]"
                >
                  <User size={18} className="text-purple-600" />
                  <span
                    className="font-header font-bold text-stone-800"
                    style={{ fontSize: "13px" }}
                  >
                    Gợi Ý Size (AI)
                  </span>
                </button>
              </div>
            </div>

            {/* Colors Selection */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                  }}
                >
                  MÀU SẮC: {selectedColor}
                </span>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  {product.colors.map((c) => {
                    const isSelected = selectedColor === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        title={c}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: translateColorHex(c),
                          border: isSelected
                            ? "2px solid var(--color-primary)"
                            : "1px solid rgba(0,0,0,0.15)",
                          boxShadow: isSelected
                            ? "0 0 0 2px white, var(--shadow-sm)"
                            : "none",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sizes Selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                  }}
                >
                  KÍCH CỠ: {selectedSize}
                </span>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  {product.sizes.map((s) => {
                    const isSelected = selectedSize === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        style={{
                          padding: "12px 28px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 700,
                          backgroundColor: isSelected
                            ? "var(--color-primary)"
                            : "white",
                          color: isSelected
                            ? "white"
                            : "var(--color-text-primary)",
                          border: isSelected
                            ? "1px solid var(--color-primary)"
                            : "1px solid var(--color-light-border)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          minWidth: "56px",
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TIME SELECTION WIDGET */}
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                border: "1px solid var(--color-light-border)",
                overflow: "hidden",
              }}
            >
              {/* Switcher Tab */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--color-light-border)",
                  backgroundColor: "#F9F6F0",
                }}
              >
                <button
                  onClick={() => setRentalMode("DAILY")}
                  style={{
                    flex: 1,
                    padding: "16px",
                    fontFamily: "var(--font-header)",
                    fontWeight: 700,
                    fontSize: "14px",
                    border: "none",
                    backgroundColor:
                      rentalMode === "DAILY" ? "white" : "transparent",
                    color:
                      rentalMode === "DAILY"
                        ? "var(--color-primary-dark)"
                        : "var(--color-text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    borderRight: "1px solid var(--color-light-border)",
                  }}
                >
                  Thuê Theo Ngày
                </button>
                <button
                  onClick={() => setRentalMode("HOURLY")}
                  style={{
                    flex: 1,
                    padding: "16px",
                    fontFamily: "var(--font-header)",
                    fontWeight: 700,
                    fontSize: "14px",
                    border: "none",
                    backgroundColor:
                      rentalMode === "HOURLY" ? "white" : "transparent",
                    color:
                      rentalMode === "HOURLY"
                        ? "var(--color-primary-dark)"
                        : "var(--color-text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Thuê Theo Giờ
                </button>
              </div>

              {/* Selector Panels */}
              <div style={{ padding: "24px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 200px",
                    gap: "32px",
                    alignItems: "start",
                  }}
                >
                  {/* LEFT: Calendar Grid */}
                  <div>
                    {/* Month navigation header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "16px",
                      }}
                    >
                      <button
                        onClick={() => {
                          const d = new Date(calendarDate);
                          d.setMonth(d.getMonth() - 1);
                          setCalendarDate(d);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px",
                          borderRadius: "4px",
                          color: "var(--color-primary)",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--color-text-primary)",
                        }}
                      >
                        Tháng {calendarDate.getMonth() + 1},{" "}
                        {calendarDate.getFullYear()}
                      </span>
                      <button
                        onClick={() => {
                          const d = new Date(calendarDate);
                          d.setMonth(d.getMonth() + 1);
                          setCalendarDate(d);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px",
                          borderRadius: "4px",
                          color: "var(--color-primary)",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Calendar grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: "4px",
                        textAlign: "center",
                      }}
                    >
                      {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w) => (
                        <span
                          key={w}
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            color: "#8C827A",
                            padding: "4px 0",
                          }}
                        >
                          {w}
                        </span>
                      ))}
                      {calendarDays.map((d, idx) => {
                        if (d.isEmpty) return <div key={`e-${idx}`} />;

                        const isDaySelected =
                          rentalMode === "HOURLY"
                            ? singleDate === d.dateStr
                            : startDate === d.dateStr || endDate === d.dateStr;

                        const isDayInRange =
                          rentalMode === "DAILY" &&
                          startDate &&
                          endDate &&
                          d.dateStr > startDate &&
                          d.dateStr < endDate;

                        return (
                          <button
                            key={d.day}
                            disabled={!d.isAvailable}
                            onClick={() => handleCalendarDayClick(d.dateStr)}
                            style={{
                              aspectRatio: "1",
                              border: isDaySelected
                                ? "2px solid var(--color-primary-dark)"
                                : "1px solid transparent",
                              borderRadius: "8px",
                              backgroundColor: isDaySelected
                                ? "var(--color-primary-dark)"
                                : isDayInRange
                                  ? "#FFF0F1"
                                  : !d.isAvailable
                                    ? "#F5F5F5"
                                    : d.isWeekend
                                      ? "#FCF9F2"
                                      : "#FFFFFF",
                              color: !d.isAvailable
                                ? "#CCCCCC"
                                : isDaySelected
                                  ? "#FFFFFF"
                                  : isDayInRange
                                    ? "var(--color-primary-dark)"
                                    : "#4A4440",
                              fontWeight:
                                isDaySelected || isDayInRange ? 700 : 500,
                              fontSize: "12px",
                              cursor: !d.isAvailable
                                ? "not-allowed"
                                : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                              padding: 0,
                            }}
                          >
                            {d.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* RIGHT: Time Selectors (HOURLY) or Range Summary (DAILY) */}
                  <div>
                    {rentalMode === "HOURLY" ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "16px",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 800,
                            color: "#8C827A",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: "8px",
                          }}
                        >
                          CHỌN GIỜ THUÊ (MỖI Ô 2 TIẾNG)
                        </h3>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(130px, 1fr))",
                            gap: "10px",
                          }}
                        >
                          {productSlots.map((block, idx) => {
                            const isBusy = bookedSlotsOnSelectedDate.some(
                              (bookedSlot) =>
                                isTimeSlotOverlap(
                                  `${block.start}-${block.end}`,
                                  bookedSlot,
                                ),
                            );
                            const today = new Date();
                            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                            const isPast =
                              singleDate === todayStr &&
                              (() => {
                                const [sh, sm] = block.start
                                  .split(":")
                                  .map(Number);
                                return (
                                  sh < today.getHours() ||
                                  (sh === today.getHours() &&
                                    sm <= today.getMinutes())
                                );
                              })();

                            const isSelected =
                              idx >= startSlotIndex && idx <= endSlotIndex;

                            return (
                              <button
                                key={block.label}
                                type="button"
                                disabled={isBusy || isPast}
                                onClick={() => handleSlotClick(idx)}
                                style={{
                                  padding: "12px 8px",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: "4px",
                                  cursor:
                                    isBusy || isPast
                                      ? "not-allowed"
                                      : "pointer",
                                  backgroundColor: isSelected
                                    ? "var(--color-primary-dark)"
                                    : isBusy || isPast
                                      ? "#EAEAE8"
                                      : "#FFFFFF",
                                  color: isSelected
                                    ? "#FFFFFF"
                                    : isBusy || isPast
                                      ? "#A0A09E"
                                      : "var(--color-text-primary)",
                                  border: isSelected
                                    ? "1.5px solid var(--color-primary-dark)"
                                    : "1.5px solid rgba(45, 41, 38, 0.15)",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span>{block.label}</span>
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 600,
                                    opacity: 0.85,
                                  }}
                                >
                                  {isBusy
                                    ? "Đã bận"
                                    : isPast
                                      ? "Đã qua"
                                      : isSelected
                                        ? "Đã chọn"
                                        : "Trống"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontStyle: "italic",
                            color: "var(--color-text-secondary)",
                            marginTop: "8px",
                            lineHeight: 1.4,
                          }}
                        >
                          * Bạn có thể chọn liên tiếp nhiều ô để thuê nhiều giờ
                          (Ví dụ: click ô 8h-10h rồi click ô 10h-12h).
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "16px",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "#8C827A",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: "4px",
                          }}
                        >
                          THỜI GIAN THUÊ
                        </h3>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              NGÀY NHẬN ĐỒ
                            </span>
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {startDate
                                ? formatSingleDate(startDate)
                                : "Chưa chọn"}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              NGÀY TRẢ ĐỒ
                            </span>
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {endDate
                                ? formatSingleDate(endDate)
                                : "Chưa chọn"}
                            </span>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "10px",
                            fontStyle: "italic",
                            color: "var(--color-text-secondary)",
                            marginTop: "8px",
                            lineHeight: 1.4,
                          }}
                        >
                          * Chọn Ngày nhận và Ngày trả trực tiếp trên lịch.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION ACTIONS */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {isCurrentTimeSlotBusy && (
                <div
                  style={{
                    color: "#C0392B",
                    backgroundColor: "#FADBD8",
                    border: "1px solid #F1948A",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: 650,
                    textAlign: "center",
                    marginBottom: "10px",
                  }}
                >
                  ⚠️ Trang phục đã bận trong khung giờ này. Vui lòng chọn giờ
                  hoặc ngày khác!
                </div>
              )}

              {availability.state === 'checking' && (
                <div style={{ color: '#6B5B4D', fontSize: '14px' }}>
                  Đang kiểm tra lịch trống...
                </div>
              )}
              {availability.state === 'available' && availability.result && (
                <div style={{ color: '#1E7A46', fontSize: '14px' }}>
                  Còn {availability.result.availableQuantity} sản phẩm phù hợp với lịch thuê đã chọn.
                </div>
              )}
              {availability.state === 'unavailable' && (
                <div style={{ color: '#C0392B', fontSize: '14px' }}>
                  Không đủ số lượng cho lịch thuê đã chọn. Vui lòng đổi ngày, giờ hoặc số lượng.
                </div>
              )}
              {availability.state === 'error' && (
                <div style={{ color: '#8C6D1F', fontSize: '14px' }}>
                  Chưa thể kiểm tra lịch ngay lúc này. Hệ thống sẽ kiểm tra lại trước khi xác nhận thuê.
                </div>
              )}
            {/* Quantity Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', border: '1px solid var(--color-light-border)', borderRadius: '12px', padding: '12px 18px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Số lượng thuê</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setBookingQty(q => Math.max(1, q - 1))}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--color-primary-dark)', outline: 'none' }}
                >
                  -
                </button>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-text-primary)', minWidth: '20px', textAlign: 'center' }}>{bookingQty}</span>
                <button 
                  type="button" 
                  onClick={() => setBookingQty(q => q + 1)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--color-primary-dark)', outline: 'none' }}
                >
                  +
                </button>
              </div>
            </div>

              <button 
                onClick={handleAddToCart}
                disabled={isCurrentTimeSlotBusy || availability.state === 'checking' || availability.state === 'unavailable'}
                className="vh-btn vh-btn-outline vh-btn-lg"
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  fontSize: "16px",
                  height: "54px",
                  fontWeight: 700,
                  border: isCurrentTimeSlotBusy
                    ? "1.5px solid #8C827A"
                    : "1.5px solid var(--color-primary-dark)",
                  backgroundColor: "transparent",
                  color: isCurrentTimeSlotBusy
                    ? "#8C827A"
                    : "var(--color-primary-dark)",
                  cursor: isCurrentTimeSlotBusy ? "not-allowed" : "pointer",
                }}
              >
                THÊM VÀO GIỎ HÀNG
              </button>

              <button
                onClick={handleBookingSubmit}
                disabled={isCurrentTimeSlotBusy || availability.state === 'checking' || availability.state === 'unavailable'}
                className="vh-btn vh-btn-primary vh-btn-lg"
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  fontSize: "16px",
                  height: "54px",
                  fontWeight: 700,
                  backgroundColor: isCurrentTimeSlotBusy
                    ? "#8C827A"
                    : "var(--color-primary-dark)",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: isCurrentTimeSlotBusy ? "not-allowed" : "pointer",
                }}
              >
                <span>THUÊ NGAY</span>
                <ArrowRight size={18} />
              </button>

              {/* COMBO BANNER */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#2D2926",
                  color: "white",
                  borderRadius: "12px",
                  padding: "14px 20px",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <Camera size={18} className="text-amber-400" />
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>
                    ĐẶT KÈM THỢ CHỤP (COMBO)
                  </span>
                </div>
                <button
                  onClick={() => setIsComboOpen(true)}
                  className="vh-btn vh-btn-secondary font-header font-bold"
                  style={{
                    borderRadius: "6px",
                    fontSize: "11px",
                    padding: "6px 14px",
                    border: "none",
                  }}
                >
                  CHI TIẾT
                </button>
              </div>
            </div>

            {/* Micro value bullets */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--color-light-border)",
                paddingTop: "20px",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
              }}
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <MapPin size={14} className="text-stone-500" /> Nhận tại cửa
                hàng
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Shield size={14} className="text-stone-500" /> Bảo mật thanh
                toán
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM: Description Tabs */}
        <section
          style={{
            marginTop: "80px",
            borderTop: "1px solid var(--color-light-border)",
            paddingTop: "40px",
          }}
        >
          {/* Tab buttons */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-light-border)",
              gap: "40px",
              marginBottom: "24px",
              overflowX: "auto",
            }}
          >
            <button
              onClick={() => setActiveInfoTab("details")}
              style={{
                background: "none",
                border: "none",
                fontFamily: "var(--font-header)",
                fontSize: "16px",
                fontWeight: 700,
                paddingBottom: "16px",
                borderBottom:
                  activeInfoTab === "details"
                    ? "2px solid var(--color-primary)"
                    : "none",
                color:
                  activeInfoTab === "details"
                    ? "var(--color-primary-dark)"
                    : "var(--color-text-secondary)",
                cursor: "pointer",
              }}
            >
              CHI TIẾT SẢN PHẨM
            </button>
            <button
              onClick={() => setActiveInfoTab("policies")}
              style={{
                background: "none",
                border: "none",
                fontFamily: "var(--font-header)",
                fontSize: "16px",
                fontWeight: 700,
                paddingBottom: "16px",
                borderBottom:
                  activeInfoTab === "policies"
                    ? "2px solid var(--color-primary)"
                    : "none",
                color:
                  activeInfoTab === "policies"
                    ? "var(--color-primary-dark)"
                    : "var(--color-text-secondary)",
                cursor: "pointer",
              }}
            >
              QUY ĐỊNH THUÊ
            </button>
            <button
              onClick={() => setActiveInfoTab("guide")}
              style={{
                background: "none",
                border: "none",
                fontFamily: "var(--font-header)",
                fontSize: "16px",
                fontWeight: 700,
                paddingBottom: "16px",
                borderBottom:
                  activeInfoTab === "guide"
                    ? "2px solid var(--color-primary)"
                    : "none",
                color:
                  activeInfoTab === "guide"
                    ? "var(--color-primary-dark)"
                    : "var(--color-text-secondary)",
                cursor: "pointer",
              }}
            >
              HƯỚNG DẪN SỬ DỤNG
            </button>
          </div>

          {/* Tab content */}
          <div
            style={{
              minHeight: "120px",
              fontSize: "14px",
              color: "var(--color-text-secondary)",
              lineHeight: 1.8,
            }}
          >
            {activeInfoTab === "details" && (
              <div className="animate-fade-in">
                <p>
                  {product.description ||
                    "Chưa có mô tả chi tiết cho sản phẩm này."}
                </p>
                <ul
                  style={{
                    listStyleType: "disc",
                    marginLeft: "20px",
                    marginTop: "12px",
                  }}
                >
                  <li>
                    Chất liệu chính:{" "}
                    {product.materials?.join(", ") || "Lụa Hà Đông"}
                  </li>
                  <li>
                    Kích thước hỗ trợ: {product.sizes?.join(", ") || "S, M, L"}
                  </li>
                  <li>
                    Thích hợp chụp ngoại cảnh Đại Nội Huế, Chùa Thiên Mụ, và
                    lăng tẩm hoàng cung.
                  </li>
                </ul>
              </div>
            )}

            {activeInfoTab === "policies" && (
              <div className="animate-fade-in">
                <p>
                  1. Tiền đặt cọc sẽ được hoàn lại 100% sau khi cửa hàng nhận
                  lại sản phẩm và xác nhận không có hư hại nghiêm trọng (rách,
                  cháy, phai màu loang lổ).
                </p>
                <p>
                  2. Khách thuê có trách nhiệm bảo quản trang phục sạch sẽ. Vết
                  bẩn nhẹ có thể giặt sạch không bị tính phí. Hư hại nặng đền bù
                  theo thỏa thuận.
                </p>
                <p>
                  3. Trả đồ quá hạn ngày phạt 100.000đ / ngày đối với hình thức
                  thuê ngày.
                </p>
              </div>
            )}

            {activeInfoTab === "guide" && (
              <div className="animate-fade-in">
                <p>
                  1. Không được tự ý là/ủi trang phục ở nhiệt độ cao. Chỉ sử
                  dụng bàn là hơi nước ở nhiệt độ thích hợp cho lụa và gấm.
                </p>
                <p>
                  2. Tránh để trang phục tiếp xúc với các vật nhọn, trang sức
                  gai góc có thể làm xước tơ lụa.
                </p>
                <p>
                  3. Khi di chuyển chụp ảnh ngoài trời, hãy nâng nhẹ tà áo để
                  tránh kéo lê trên bùn đất hoặc đá nhọn.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* BOTTOM: Photographers recommended list */}
        <section style={{ marginTop: "80px" }}>
          <div
            style={{
              marginBottom: "40px",
              textAlign: "left",
              maxWidth: "100%",
              margin: "0 0 40px 0",
              alignItems: "flex-start",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              className="vh-section-badge"
              style={{ display: "inline-block", marginBottom: "12px" }}
            >
              Nhiếp Ảnh Gia Gợi Ý
            </span>
            <h2
              style={{
                fontSize: "28px",
                fontWeight: 700,
                fontFamily: "var(--font-header)",
                color: "#1c1917",
                marginTop: "4px",
              }}
            >
              Hoàn thiện trải nghiệm với các gói chụp ảnh chuyên nghiệp
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "32px",
            }}
          >
            {suggestedPhotographers.map((photographer) => (
              <div
                key={photographer.id}
                className="vh-premium-card"
                style={{
                  padding: "20px",
                  backgroundColor: "white",
                  border: "1px solid var(--color-light-border)",
                }}
              >
                <div
                  className="vh-card-image-wrapper"
                  style={{ height: "240px" }}
                >
                  <img
                    src={photographer.image}
                    alt={photographer.name}
                    className="vh-card-image"
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      zIndex: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255,255,255,0.95)",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    <Star
                      size={11}
                      className="fill-amber-400 stroke-amber-400"
                    />
                    <span>{photographer.rating}</span>
                    <span
                      style={{
                        color: "var(--color-text-secondary)",
                        fontWeight: 400,
                      }}
                    >
                      ({photographer.count})
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: "16px" }}>
                  <h4
                    className="font-header font-bold text-stone-900"
                    style={{ fontSize: "18px" }}
                  >
                    {photographer.name}
                  </h4>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--color-text-secondary)",
                      marginTop: "8px",
                      lineHeight: 1.6,
                    }}
                  >
                    {photographer.desc}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "24px",
                      paddingTop: "16px",
                      borderTop: "1px solid var(--color-light-border)",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--color-text-secondary)",
                          display: "block",
                          textTransform: "uppercase",
                        }}
                      >
                        Gói chụp từ
                      </span>
                      <strong
                        className="font-header"
                        style={{
                          fontSize: "18px",
                          color: "var(--color-primary-dark)",
                        }}
                      >
                        {photographer.price}
                      </strong>
                    </div>
                    <button
                      onClick={() =>
                        navigate(`/photographers/${photographer.id}`)
                      }
                      className="vh-btn vh-btn-outline vh-btn-sm"
                      style={{ borderRadius: "6px" }}
                    >
                      Đặt ngay
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM: Review stats diary */}
        <section
          style={{
            marginTop: "80px",
            borderTop: "1px solid var(--color-light-border)",
            paddingTop: "60px",
          }}
        >
          <div
            style={{
              marginBottom: "40px",
              textAlign: "left",
              maxWidth: "100%",
              margin: "0 0 40px 0",
              alignItems: "flex-start",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              className="vh-section-badge"
              style={{ display: "inline-block", marginBottom: "12px" }}
            >
              Nhật Ký Áo Dài
            </span>
            <h2
              style={{
                fontSize: "28px",
                fontWeight: 700,
                fontFamily: "var(--font-header)",
                color: "#1c1917",
                marginTop: "4px",
              }}
            >
              Khách hàng tỏa sáng trong tà áo Di Sản
            </h2>
          </div>

          {/* Rating overview grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr 240px",
              gap: "48px",
              alignItems: "center",
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "40px",
              border: "1px solid var(--color-light-border)",
              marginBottom: "40px",
            }}
          >
            {/* Average rating */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                className="font-header"
                style={{
                  fontSize: "56px",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                }}
              >
                {reviewStats.averageRating.toFixed(1)}
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "2px",
                  color: "var(--color-gold)",
                }}
              >
                {[1, 2, 3, 4, 5].map((starIdx) => (
                  <Star
                    key={starIdx}
                    size={18}
                    fill={
                      starIdx <= Math.round(reviewStats.averageRating)
                        ? "currentColor"
                        : "none"
                    }
                    color="currentColor"
                  />
                ))}
              </div>
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--color-text-secondary)",
                }}
              >
                {reviewStats.totalReviews} đánh giá thực tế
              </span>
            </div>

            {/* Bars summary */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {[
                { stars: "5 sao", percent: reviewStats.breakdown[5] },
                { stars: "4 sao", percent: reviewStats.breakdown[4] },
                { stars: "3 sao", percent: reviewStats.breakdown[3] },
                { stars: "2 sao", percent: reviewStats.breakdown[2] },
                { stars: "1 sao", percent: reviewStats.breakdown[1] },
              ].map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <span style={{ width: "40px", textAlign: "right" }}>
                    {row.stars}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "6px",
                      backgroundColor: "#F0EBE0",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: row.percent,
                        height: "100%",
                        backgroundColor: "var(--color-gold)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                  <span style={{ width: "32px" }}>{row.percent}</span>
                </div>
              ))}
            </div>

            {/* Action write button */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              {reviewStatus?.alreadyReviewed ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "#F0FDF4",
                    color: "#15803D",
                    border: "1px solid #BBF7D0",
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  <Check size={16} /> ĐÃ ĐÁNH GIÁ
                </div>
              ) : (
                <button
                  onClick={handleWriteReviewClick}
                  disabled={checkingReviewStatus}
                  className="vh-btn vh-btn-inverted font-header"
                  style={{
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {checkingReviewStatus ? "ĐANG KIỂM TRA..." : "VIẾT ĐÁNH GIÁ"}
                </button>
              )}
            </div>
          </div>

          {/* Rating filter tools */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--color-light-border)",
              paddingBottom: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "24px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              <span
                onClick={() => setReviewSortOrder("newest")}
                style={{
                  color:
                    reviewSortOrder === "newest"
                      ? "var(--color-primary)"
                      : "var(--color-text-secondary)",
                  cursor: "pointer",
                  borderBottom:
                    reviewSortOrder === "newest"
                      ? "2px solid var(--color-primary)"
                      : "none",
                  paddingBottom: "4px",
                  transition: "all 0.2s",
                }}
              >
                Mới nhất
              </span>
              <span
                onClick={() => setReviewSortOrder("highest")}
                style={{
                  color:
                    reviewSortOrder === "highest"
                      ? "var(--color-primary)"
                      : "var(--color-text-secondary)",
                  cursor: "pointer",
                  borderBottom:
                    reviewSortOrder === "highest"
                      ? "2px solid var(--color-primary)"
                      : "none",
                  paddingBottom: "4px",
                  transition: "all 0.2s",
                }}
              >
                Đánh giá cao nhất
              </span>
              <span
                onClick={() => setReviewSortOrder("lowest")}
                style={{
                  color:
                    reviewSortOrder === "lowest"
                      ? "var(--color-primary)"
                      : "var(--color-text-secondary)",
                  cursor: "pointer",
                  borderBottom:
                    reviewSortOrder === "lowest"
                      ? "2px solid var(--color-primary)"
                      : "none",
                  paddingBottom: "4px",
                  transition: "all 0.2s",
                }}
              >
                Đánh giá thấp nhất
              </span>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                cursor: "pointer",
                color: "var(--color-text-secondary)",
              }}
            >
              <input
                type="checkbox"
                checked={reviewFilterHasImage}
                onChange={(e) => setReviewFilterHasImage(e.target.checked)}
                style={{ accentColor: "var(--color-primary)" }}
              />
              <span>Có ảnh/video</span>
            </label>
          </div>

          {/* Reviews list */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "32px" }}
          >
            {loadingReviews ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "var(--color-text-secondary)",
                }}
              >
                Đang tải đánh giá...
              </div>
            ) : displayedReviews.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--color-text-secondary)",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid var(--color-light-border)",
                }}
              >
                {reviewFilterHasImage
                  ? "Không tìm thấy đánh giá nào có hình ảnh thực tế."
                  : "Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên thuê và đánh giá!"}
              </div>
            ) : (
              displayedReviews.map((rev) => {
                const authorName =
                  rev.customerId?.profile?.fullName || "Khách hàng VibeHue";
                const authorAvatar =
                  rev.customerId?.profile?.avatarUrl ||
                  rev.customerId?.profile?.avatar;
                const formattedDate = new Date(
                  rev.createdAt || rev.date || Date.now(),
                ).toLocaleDateString("vi-VN");
                const firstLetter = authorName.charAt(0).toUpperCase();

                return (
                  <div
                    key={rev._id || rev.id}
                    style={{
                      borderBottom: "1px solid var(--color-light-border)",
                      paddingBottom: "32px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ display: "flex", gap: "12px" }}>
                        {authorAvatar ? (
                          <img
                            src={getImageUrl(authorAvatar)}
                            alt={authorName}
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              backgroundColor: "#EADFC9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: "var(--color-primary-dark)",
                              fontSize: "14px",
                            }}
                          >
                            {firstLetter}
                          </div>
                        )}
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <strong
                              style={{
                                fontSize: "14px",
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {authorName}
                            </strong>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                backgroundColor: "var(--color-success-bg)",
                                color: "var(--color-success)",
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "9999px",
                              }}
                            >
                              <Check size={10} /> ĐÃ THUÊ
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "2px",
                              color: "var(--color-gold)",
                              marginTop: "4px",
                            }}
                          >
                            {Array.from({ length: Math.round(rev.rating) }).map(
                              (_, sIdx) => (
                                <Star
                                  key={sIdx}
                                  size={11}
                                  fill="currentColor"
                                  color="currentColor"
                                />
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {formattedDate}
                        </span>
                        <button
                          onClick={() => handleReportReview(rev._id || rev.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#9CA3AF",
                            fontSize: "11px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#DC2626";
                            e.currentTarget.style.backgroundColor = "#FEE2E2";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#9CA3AF";
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                          title="Báo cáo review spam/vi phạm"
                        >
                          <Flag size={10} />
                          <span>Báo cáo Spam</span>
                        </button>
                      </div>
                    </div>

                    <p
                      style={{
                        fontSize: "14px",
                        color: "var(--color-text-primary)",
                        marginTop: "16px",
                        lineHeight: 1.7,
                      }}
                    >
                      {rev.comment}
                    </p>

                    {rev.images && rev.images.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          marginTop: "16px",
                        }}
                      >
                        {rev.images.map((imgUrl: string, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              width: "80px",
                              height: "100px",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: "1px solid rgba(0,0,0,0.1)",
                            }}
                          >
                            <img
                              src={getImageUrl(imgUrl)}
                              alt="review media"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {rev.reply && (
                      <div
                        style={{
                          marginTop: "16px",
                          padding: "16px",
                          backgroundColor: "#F5EFEB",
                          borderRadius: "12px",
                          borderLeft: "4px solid var(--color-primary)",
                          fontSize: "13px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "6px",
                          }}
                        >
                          <strong
                            style={{ color: "var(--color-primary-dark)" }}
                          >
                            Phản hồi từ cửa hàng
                          </strong>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            {new Date(
                              rev.repliedAt || new Date(),
                            ).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <p
                          style={{
                            color: "var(--color-text-primary)",
                            margin: 0,
                            lineHeight: 1.6,
                          }}
                        >
                          {rev.reply}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* -------------------- INTERACTIVE MODALS -------------------- */}

      {/* 1. AI Virtual Try-On Modal */}
      <Modal
        isOpen={isAiStylingOpen}
        onClose={() => setIsAiStylingOpen(false)}
        title="Trải nghiệm Phòng Thử Đồ ẢO (AI Virtual Try-On)"
        maxWidth="640px"
      >
        <div style={{ padding: "10px 0", textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: "var(--color-primary-trans)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Sparkles size={36} className="animate-bounce" />
          </div>
          <h3 className="font-header text-xl font-bold text-stone-900 mb-2">
            Đang khởi tạo công nghệ AI Virtual Try-On
          </h3>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              maxWidth: "480px",
              margin: "0 auto 24px",
            }}
          >
            Hệ thống đang đồng bộ chỉ số cơ thể từ trang cá nhân của bạn để dựng
            mô phỏng 3D chính xác tà áo **{product.name}** trên dáng người của
            bạn.
          </p>

          <div
            style={{
              border: "1px solid rgba(182, 145, 91, 0.2)",
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "white",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              textAlign: "left",
              maxWidth: "400px",
              margin: "0 auto 24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
              }}
            >
              <span>Chiều cao ước tính:</span>
              <strong>165 cm</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
              }}
            >
              <span>Cân nặng ước tính:</span>
              <strong>52 kg</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
              }}
            >
              <span>Dáng người phân tích:</span>
              <strong>Đồng hồ cát (Hourglass)</strong>
            </div>
          </div>

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <button
              className="vh-btn vh-btn-secondary"
              style={{ padding: "8px 24px", borderRadius: "8px" }}
              onClick={() => {
                toast.success("Mô phỏng 3D hoàn tất!");
                setIsAiStylingOpen(false);
              }}
            >
              BẮT ĐẦU XEM MÔ PHỎNG
            </button>
            <button
              className="vh-btn vh-btn-outline"
              style={{ padding: "8px 24px", borderRadius: "8px" }}
              onClick={() => setIsAiStylingOpen(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. AI Size Suggestion Modal */}
      <Modal
        isOpen={isAiSizeOpen}
        onClose={() => setIsAiSizeOpen(false)}
        title="Gợi ý Size Thông Minh bởi AI"
        maxWidth="500px"
      >
        <div
          style={{
            padding: "10px 0",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <p
            style={{
              fontSize: "13.5px",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Nhập số đo cơ thể của bạn bên dưới để Trợ lý AI phân tích và đưa ra
            đề xuất kích cỡ tối ưu nhất cho thiết kế{" "}
            <strong>{product.name}</strong>.
          </p>

          {/* Form Fields Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              backgroundColor: "#FAF8F5",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #EAE1D4",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{ fontSize: "12px", fontWeight: 700, color: "#4A4440" }}
              >
                Chiều cao (cm)
              </label>
              <input
                type="number"
                value={aiHeight}
                onChange={(e) => {
                  const val = e.target.value;
                  setAiHeight(val === "" ? "" : parseInt(val) || 0);
                }}
                onBlur={() => {
                  if (aiHeight !== "") {
                    setAiHeight(Math.max(100, Math.min(250, Number(aiHeight))));
                  }
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #D5C2AD",
                  outline: "none",
                  fontSize: "13.5px",
                  fontWeight: 600,
                }}
              />
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{ fontSize: "12px", fontWeight: 700, color: "#4A4440" }}
              >
                Cân nặng (kg)
              </label>
              <input
                type="number"
                value={aiWeight}
                onChange={(e) => {
                  const val = e.target.value;
                  setAiWeight(val === "" ? "" : parseInt(val) || 0);
                }}
                onBlur={() => {
                  if (aiWeight !== "") {
                    setAiWeight(Math.max(20, Math.min(200, Number(aiWeight))));
                  }
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #D5C2AD",
                  outline: "none",
                  fontSize: "13.5px",
                  fontWeight: 600,
                }}
              />
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{ fontSize: "12px", fontWeight: 700, color: "#4A4440" }}
              >
                Vòng ngực (cm)
              </label>
              <input
                type="number"
                value={aiChest}
                onChange={(e) => {
                  const val = e.target.value;
                  setAiChest(val === "" ? "" : parseInt(val) || 0);
                }}
                onBlur={() => {
                  if (aiChest !== "") {
                    setAiChest(Math.max(40, Math.min(150, Number(aiChest))));
                  }
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #D5C2AD",
                  outline: "none",
                  fontSize: "13.5px",
                  fontWeight: 600,
                }}
              />
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{ fontSize: "12px", fontWeight: 700, color: "#4A4440" }}
              >
                Vòng eo (cm)
              </label>
              <input
                type="number"
                value={aiWaist}
                onChange={(e) => {
                  const val = e.target.value;
                  setAiWaist(val === "" ? "" : parseInt(val) || 0);
                }}
                onBlur={() => {
                  if (aiWaist !== "") {
                    setAiWaist(Math.max(30, Math.min(150, Number(aiWaist))));
                  }
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #D5C2AD",
                  outline: "none",
                  fontSize: "13.5px",
                  fontWeight: 600,
                }}
              />
            </div>
            <div
              style={{
                gridColumn: "span 2",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <label
                style={{ fontSize: "12px", fontWeight: 700, color: "#4A4440" }}
              >
                Sở thích mặc áo dài
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setAiFitPref("SLIM")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    border:
                      aiFitPref === "SLIM"
                        ? "1.5px solid var(--color-primary-dark)"
                        : "1px solid #D5C2AD",
                    backgroundColor:
                      aiFitPref === "SLIM"
                        ? "var(--color-primary-trans)"
                        : "white",
                    color:
                      aiFitPref === "SLIM"
                        ? "var(--color-primary-dark)"
                        : "#7E6D5B",
                    cursor: "pointer",
                  }}
                >
                  Mặc ôm dáng
                </button>
                <button
                  type="button"
                  onClick={() => setAiFitPref("COMFORT")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    border:
                      aiFitPref === "COMFORT"
                        ? "1.5px solid var(--color-primary-dark)"
                        : "1px solid #D5C2AD",
                    backgroundColor:
                      aiFitPref === "COMFORT"
                        ? "var(--color-primary-trans)"
                        : "white",
                    color:
                      aiFitPref === "COMFORT"
                        ? "var(--color-primary-dark)"
                        : "#7E6D5B",
                    cursor: "pointer",
                  }}
                >
                  Mặc thoải mái
                </button>
              </div>
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            type="button"
            disabled={isAiLoading}
            onClick={handleAiSizeCalculation}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              backgroundColor: isAiLoading
                ? "#8C827A"
                : "var(--color-primary-dark)",
              color: "white",
              border: "none",
              fontSize: "14px",
              fontWeight: 700,
              cursor: isAiLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {isAiLoading ? (
              <>ĐANG PHÂN TÍCH BỞI AI...</>
            ) : (
              <>
                <Sparkles size={16} />
                <span>PHÂN TÍCH SỐ ĐO BẰNG AI</span>
              </>
            )}
          </button>

          {/* Result Block */}
          {(aiResultSize || aiReason) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                backgroundColor: "white",
                border: "1.5px solid rgba(182, 145, 91, 0.4)",
                padding: "20px",
                borderRadius: "12px",
                animation: "fadeIn 0.25s ease-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#8C827A",
                  }}
                >
                  SIZE ĐỀ XUẤT TỐI ƯU:
                </span>
                <span
                  style={{
                    fontSize: aiResultSize === "CUSTOM" ? "15px" : "24px",
                    fontWeight: 800,
                    color:
                      aiResultSize === "CUSTOM"
                        ? "#B85C00"
                        : "var(--color-primary-dark)",
                    fontFamily: "var(--font-header)",
                  }}
                >
                  {aiResultSize === "CUSTOM"
                    ? "ĐẶT MAY / LIÊN HỆ SHOP"
                    : `SIZE ${aiResultSize}`}
                </span>
              </div>
              <div
                style={{
                  height: "1px",
                  backgroundColor: "rgba(182, 145, 91, 0.15)",
                }}
              />
              <p
                style={{
                  fontSize: "13px",
                  color: "#4A4440",
                  lineHeight: 1.6,
                  margin: 0,
                  textAlign: "justify",
                }}
              >
                {aiReason}
              </p>
            </div>
          )}

          {/* Apply size selection */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
              borderTop: "1px solid #EAEAE8",
              paddingTop: "16px",
              marginTop: "4px",
            }}
          >
            <button
              className="vh-btn vh-btn-outline"
              style={{
                padding: "8px 24px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              onClick={() => setIsAiSizeOpen(false)}
            >
              Hủy bỏ
            </button>
            {aiResultSize && aiResultSize !== "CUSTOM" && (
              <button
                className="vh-btn vh-btn-primary"
                style={{
                  padding: "8px 24px",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                onClick={() => {
                  setSelectedSize(aiResultSize);
                  toast.success(`Đã áp dụng đề xuất Size ${aiResultSize}!`);
                  setIsAiSizeOpen(false);
                }}
              >
                ÁP DỤNG SIZE {aiResultSize}
              </button>
            )}
            {aiResultSize === "CUSTOM" && (
              <button
                className="vh-btn vh-btn-primary"
                style={{
                  padding: "8px 24px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  backgroundColor: "#B85C00",
                  borderColor: "#B85C00",
                }}
                onClick={() => {
                  toast.info(
                    "Vui lòng liên hệ hotline hoặc nhắn tin trực tiếp để được tư vấn thiết kế may đo riêng!",
                  );
                  window.open("https://zalo.me/", "_blank");
                  setIsAiSizeOpen(false);
                }}
              >
                LIÊN HỆ TƯ VẤN MAY
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* 3. Combo Details Modal */}
      <Modal
        isOpen={isComboOpen}
        onClose={() => setIsComboOpen(false)}
        title="Chi tiết gói Combo Tiết kiệm"
        maxWidth="550px"
      >
        <div style={{ padding: "10px 0" }}>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              marginBottom: "20px",
            }}
          >
            Nhận ngay ưu đãi **giảm giá 10%** tổng giá trị hóa đơn khi bạn lựa
            chọn kết hợp thuê tà áo dài **{product.name}** cùng bất cứ nhiếp ảnh
            gia tiêu biểu nào của hệ thống.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              backgroundColor: "white",
              border: "1px solid var(--color-light-border)",
              padding: "16px",
              borderRadius: "12px",
              marginBottom: "24px",
              fontSize: "13px",
            }}
          >
            <div>✔️ Giảm ngay 10% phí thuê áo dài</div>
            <div>✔️ Giảm ngay 10% phí book thợ chụp ảnh ngoại cảnh</div>
            <div>✔️ Tự động đồng bộ hóa lịch thử đồ & lịch đi chụp</div>
            <div>✔️ Hỗ trợ hợp đồng bảo hiểm di sản combo trọn gói</div>
          </div>

          <div
            style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
          >
            <button
              className="vh-btn vh-btn-primary"
              style={{ padding: "8px 24px", borderRadius: "8px" }}
              onClick={() => {
                setIsComboOpen(false);
                toast.success("Đã kích hoạt ưu đãi giảm giá Combo!");
              }}
            >
              KÍCH HOẠT COMBO
            </button>
            <button
              className="vh-btn vh-btn-outline"
              style={{ padding: "8px 24px", borderRadius: "8px" }}
              onClick={() => setIsComboOpen(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Write Review Modal */}
      <Modal
        isOpen={isWriteReviewOpen}
        onClose={() => setIsWriteReviewOpen(false)}
        title="Viết Nhận Xét & Đánh Giá"
        maxWidth="550px"
      >
        <form
          onSubmit={handleReviewSubmit}
          style={{
            padding: "10px 0",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Độ hài lòng của bạn:
            </label>
            <div
              style={{
                display: "flex",
                gap: "8px",
                color: "var(--color-gold)",
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setWriteRating(star)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <Star
                    size={28}
                    fill={star <= writeRating ? "currentColor" : "none"}
                    color="currentColor"
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Nội dung đánh giá:
            </label>
            <textarea
              required
              rows={4}
              value={writeComment}
              onChange={(e) => setWriteComment(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn về phom dáng, chất lượng vải, dịch vụ nhận/trả đồ..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #D5C2AD",
                outline: "none",
                fontFamily: "inherit",
                fontSize: "14px",
                lineHeight: 1.6,
                resize: "vertical",
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Hình ảnh thực tế đính kèm:
            </label>
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "8px",
                alignItems: "center",
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                id="write-image-file-input"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;

                  if (writeImages.length + files.length > 10) {
                    toast.error("Bạn chỉ có thể đính kèm tối đa 10 hình ảnh!");
                    return;
                  }

                  const uploadPromises = Array.from(files).map(async (file) => {
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error(`File ${file.name} vượt quá giới hạn 5MB!`);
                      return null;
                    }
                    const formData = new FormData();
                    formData.append("file", file);
                    try {
                      const res = await httpClient.post<{ url: string }>(
                        "/reviews/upload",
                        formData,
                      );
                      return res.url;
                    } catch (err: any) {
                      toast.error(
                        `Lỗi tải ảnh ${file.name}: ${err.message || "Không xác định"}`,
                      );
                      return null;
                    }
                  });

                  const uploadedUrls = await Promise.all(uploadPromises);
                  const validUrls = uploadedUrls.filter(
                    (url): url is string => url !== null,
                  );
                  if (validUrls.length > 0) {
                    setWriteImages((prev) => [...prev, ...validUrls]);
                    toast.success(
                      `Đã thêm ${validUrls.length} ảnh thành công!`,
                    );
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => {
                  document.getElementById("write-image-file-input")?.click();
                }}
                className="vh-btn vh-btn-secondary"
                style={{
                  padding: "10px 16px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>Chọn ảnh từ thiết bị...</span>
              </button>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                }}
              >
                (Tối đa 10 ảnh JPG, PNG, WEBP, tối đa 5MB/ảnh)
              </span>
            </div>
            {writeImages.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "12px",
                }}
              >
                {writeImages.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "relative",
                      width: "60px",
                      height: "60px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  >
                    <img
                      src={getImageUrl(img)}
                      alt="attached"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setWriteImages(writeImages.filter((_, i) => i !== idx))
                      }
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "16px",
                        height: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "9px",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
              borderTop: "1px solid #EAEAE8",
              paddingTop: "16px",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              className="vh-btn vh-btn-outline"
              style={{
                padding: "8px 24px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              onClick={() => setIsWriteReviewOpen(false)}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submittingReview}
              className="vh-btn vh-btn-primary"
              style={{
                padding: "8px 24px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              {submittingReview ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProductDetailPage;




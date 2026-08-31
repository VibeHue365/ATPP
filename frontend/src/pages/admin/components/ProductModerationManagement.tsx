import React, { useEffect, useState } from "react";
import { AdminReloadButton } from "./AdminReloadButton";
import {
  Check,
  Eye,
  EyeOff,
  X,
  Search,
  User,
  AlertCircle,
} from "lucide-react";
import Swal from "sweetalert2";
import { httpClient } from "../../../services/httpClient";
import { useToast } from "../../../components/feedback/Toast";
import { API_BASE_URL } from "../../../config/env";
import { AdminSmartTagPanel } from "../../../features/smart-tagging/components/AdminSmartTagPanel";

type ModerationStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "HIDDEN";

interface ProductItem {
  _id: string;
  name: string;
  description?: string;
  images?: string[];
  basePrice: number;
  depositAmount: number;
  status: string;
  moderationStatus: ModerationStatus;
  moderationReason?: string | null;
  updatedAt: string;
  categoryId?: { name?: string };
  providerId?: {
    businessName?: string;
    userId?: { profile?: { fullName?: string } };
  };
}

const labels: Record<ModerationStatus, string> = {
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối", // matching standard text or let's use 'Từ chối'
  HIDDEN: "Đã ẩn",
};

const fallbackImage =
  "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800";
const resolveImageUrl = (url?: string) =>
  !url || url.startsWith("http")
    ? url || fallbackImage
    : `${API_BASE_URL}${url}`;

export const ProductModerationManagement: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<ProductItem[]>([]);
  const [status, setStatus] = useState<ModerationStatus>("PENDING_REVIEW");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductItem | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const fetchQueue = async (nextStatus = status) => {
    setLoading(true);
    setError(null);
    try {
      const data = await httpClient.get<ProductItem[]>(
        `/admin/products/moderation?status=${nextStatus}`,
      );
      setItems(data || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể tải hàng đợi kiểm duyệt";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQueue();
  }, [status]);

  const moderate = async (
    item: ProductItem,
    action: "APPROVED" | "REJECTED" | "HIDDEN",
  ) => {
    const requiresReason = action !== "APPROVED";
    const result = await Swal.fire({
      title:
        action === "APPROVED"
          ? "Duyệt sản phẩm?"
          : action === "REJECTED"
            ? "Từ chối sản phẩm?"
            : "Ẩn sản phẩm?",
      input: requiresReason ? "textarea" : undefined,
      inputLabel: requiresReason ? "Lý do *" : undefined,
      inputPlaceholder: requiresReason
        ? "Nhập lý do để nhà cung cấp có thể xử lý..."
        : undefined,
      showCancelButton: true,
      confirmButtonText:
        action === "APPROVED"
          ? "Duyệt"
          : action === "REJECTED"
            ? "Từ chối"
            : "Ẩn",
      cancelButtonText: "Quay lại",
      confirmButtonColor: action === "APPROVED" ? "#166534" : "#991B1B",
      inputValidator: (value: string) =>
        requiresReason && !value?.trim() ? "Vui lòng nhập lý do" : undefined,
    });

    if (!result.isConfirmed) return;

    setActionId(item._id);
    try {
      await httpClient.patch(`/admin/products/${item._id}/moderation`, {
        action,
        ...(requiresReason ? { reason: result.value.trim() } : {}),
      });
      toast.success("Đã cập nhật trạng thái kiểm duyệt");
      await fetchQueue();
      if (preview?._id === item._id) setPreview(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Không thể xử lý sản phẩm";
      toast.error(message);
      await fetchQueue();
    } finally {
      setActionId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    const nameMatch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const providerMatch = (item.providerId?.businessName || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const categoryMatch = (item.categoryId?.name || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return nameMatch || providerMatch || categoryMatch;
  });

  const getStatusBadgeStyle = (moderationStatus: ModerationStatus) => {
    switch (moderationStatus) {
      case "APPROVED":
        return {
          background: "rgba(22, 101, 52, 0.9)",
          color: "#ffffff",
          boxShadow: "0 4px 10px rgba(22, 101, 52, 0.2)",
        };
      case "REJECTED":
        return {
          background: "rgba(153, 27, 27, 0.9)",
          color: "#ffffff",
          boxShadow: "0 4px 10px rgba(153, 27, 27, 0.2)",
        };
      case "HIDDEN":
        return {
          background: "rgba(122, 122, 122, 0.9)",
          color: "#ffffff",
          boxShadow: "0 4px 10px rgba(122, 122, 122, 0.2)",
        };
      default: // PENDING_REVIEW
        return {
          background: "rgba(184, 144, 71, 0.95)",
          color: "#ffffff",
          boxShadow: "0 4px 10px rgba(184, 144, 71, 0.2)",
        };
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Search and Filters Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          backgroundColor: "white",
          padding: "20px 24px",
          borderRadius: "16px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
          border: "1px solid #E8E2D5",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            minWidth: "280px",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              border: "1px solid #E8E2D5",
              borderRadius: "10px",
              padding: "0 14px",
              backgroundColor: "#FAF6F0",
              transition: "all 0.2s",
            }}
          >
            <Search size={18} color="#7A7A7A" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên sản phẩm, cửa hàng, danh mục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                background: "none",
                padding: "10px 12px",
                fontSize: "13.5px",
                width: "100%",
                outline: "none",
                color: "#2A2A2A",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#7A7A7A",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tab-styled Filters */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {(
            [
              "PENDING_REVIEW",
              "APPROVED",
              "REJECTED",
              "HIDDEN",
            ] as ModerationStatus[]
          ).map((tabStatus) => {
            const isActive = status === tabStatus;
            return (
              <button
                key={tabStatus}
                onClick={() => setStatus(tabStatus)}
                style={{
                  padding: "10px 18px",
                  border: isActive ? "none" : "1px solid #E8E2D5",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backgroundColor: isActive ? "#4A0E17" : "white",
                  color: isActive ? "white" : "#7A7A7A",
                  transition: "all 0.2s ease",
                  boxShadow: isActive
                    ? "0 4px 12px rgba(74, 14, 23, 0.15)"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#FAF6F0";
                    e.currentTarget.style.color = "#4A0E17";
                    e.currentTarget.style.borderColor = "#B89047";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "white";
                    e.currentTarget.style.color = "#7A7A7A";
                    e.currentTarget.style.borderColor = "#E8E2D5";
                  }
                }}
              >
                {labels[tabStatus]}
                <span
                  style={{
                    marginLeft: "6px",
                    padding: "2px 6px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    backgroundColor: isActive
                      ? "rgba(255,255,255,0.2)"
                      : "#FAF6F0",
                    color: isActive ? "white" : "#7A7A7A",
                  }}
                >
                  {status === tabStatus ? filteredItems.length : ""}
                </span>
              </button>
            );
          })}

          <AdminReloadButton onClick={() => void fetchQueue()} isLoading={loading} label="Tải lại" />
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            border: "1px solid #FECACA",
            color: "#991B1B",
            background: "#FEF2F2",
            borderRadius: "16px",
            boxShadow: "0 4px 12px rgba(153, 27, 27, 0.05)",
          }}
        >
          <p style={{ margin: "0 0 16px", fontWeight: 600 }}>{error}</p>
          <button
            onClick={() => void fetchQueue()}
            style={{
              border: "none",
              background: "#991B1B",
              color: "white",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(153, 27, 27, 0.2)",
            }}
          >
            Thử lại
          </button>
        </div>
      ) : loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "240px",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              border: "3px solid #E8E2D5",
              borderTop: "3px solid #4A0E17",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              animation: "spin 1s linear infinite",
            }}
          />
          <span style={{ fontSize: "14px", color: "#7A7A7A", fontWeight: 600 }}>
            Đang tải danh sách kiểm duyệt...
          </span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            padding: "60px 40px",
            textAlign: "center",
            color: "#7A7A7A",
            border: "1px solid #E8E2D5",
            borderRadius: "16px",
            backgroundColor: "white",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.01)",
          }}
        >
          <AlertCircle
            size={32}
            color="#B89047"
            style={{ marginBottom: "12px" }}
          />
          <p style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>
            Không có sản phẩm nào cần hiển thị.
          </p>
          <p
            style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#A0A0A0" }}
          >
            Hãy chọn bộ lọc hoặc tìm kiếm bằng từ khóa khác.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "24px",
          }}
        >
          {filteredItems.map((item) => {
            const isHovered = hoveredCardId === item._id;
            return (
              <article
                key={item._id}
                onMouseEnter={() => setHoveredCardId(item._id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  borderRadius: "16px",
                  background: "white",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  border: isHovered ? "1px solid #B89047" : "1px solid #E8E2D5",
                  boxShadow: isHovered
                    ? "0 12px 30px rgba(74, 14, 23, 0.08)"
                    : "0 4px 15px rgba(0, 0, 0, 0.02)",
                  transform: isHovered ? "translateY(-6px)" : "translateY(0)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                }}
              >
                {/* Image Container with Zoom effect */}
                <div
                  style={{
                    height: "210px",
                    background: "#FAF6F0",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={resolveImageUrl(item.images?.[0])}
                    onError={(event) => {
                      event.currentTarget.src = fallbackImage;
                    }}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: isHovered ? "scale(1.05)" : "scale(1)",
                      transition: "transform 0.4s ease",
                    }}
                  />
                  {/* Category Tag */}
                  {item.categoryId?.name && (
                    <span
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: "12px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "rgba(255, 255, 255, 0.85)",
                        backdropFilter: "blur(4px)",
                        color: "#4A0E17",
                        fontSize: "11px",
                        fontWeight: 700,
                        border: "1px solid rgba(74,14,23,0.1)",
                      }}
                    >
                      {item.categoryId.name}
                    </span>
                  )}
                  {/* Status Badge */}
                  <span
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                      backdropFilter: "blur(4px)",
                      ...getStatusBadgeStyle(item.moderationStatus),
                    }}
                  >
                    {labels[item.moderationStatus]}
                  </span>
                </div>

                {/* Card Content */}
                <div
                  style={{
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    flex: 1,
                  }}
                >
                  {/* Title */}
                  <strong
                    style={{
                      color: "#2A2A2A",
                      fontSize: "15.5px",
                      lineHeight: 1.45,
                      fontWeight: 800,
                      fontFamily: "serif",
                      minHeight: "44px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.name}
                  </strong>

                  {/* Provider Info */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12.5px",
                      color: "#7A7A7A",
                    }}
                  >
                    <User size={14} color="#B89047" />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                      }}
                    >
                      {item.providerId?.businessName ||
                        item.providerId?.userId?.profile?.fullName ||
                        "Nhà cung cấp"}
                    </span>
                  </div>

                  {/* Pricing grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                      padding: "12px",
                      borderRadius: "10px",
                      backgroundColor: "#FAF6F0",
                      border: "1px solid #FAF0E0",
                      marginTop: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          color: "#7A7A7A",
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                        }}
                      >
                        Giá thuê
                      </span>
                      <strong
                        style={{
                          fontSize: "14px",
                          color: "#4A0E17",
                          fontWeight: 800,
                        }}
                      >
                        {item.basePrice.toLocaleString("vi-VN")}đ
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 500,
                            color: "#7A7A7A",
                          }}
                        >
                          /ngày
                        </span>
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        borderLeft: "1px solid #E8E2D5",
                        paddingLeft: "12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          color: "#7A7A7A",
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                        }}
                      >
                        Tiền cọc
                      </span>
                      <strong
                        style={{
                          fontSize: "14px",
                          color: "#2A2A2A",
                          fontWeight: 800,
                        }}
                      >
                        {item.depositAmount.toLocaleString("vi-VN")}đ
                      </strong>
                    </div>
                  </div>

                  {/* Rejected/Hidden Reason Box */}
                  {item.moderationReason && (
                    <div
                      style={{
                        fontSize: "12.5px",
                        color: "#991B1B",
                        background: "#FEF2F2",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #FEE2E2",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "6px",
                        lineHeight: "1.4",
                      }}
                    >
                      <AlertCircle
                        size={15}
                        style={{ marginTop: "2px", flexShrink: 0 }}
                      />
                      <span>
                        <strong>Lý do từ chối:</strong> {item.moderationReason}
                      </span>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "auto",
                      paddingTop: "12px",
                      borderTop: "1px dashed #E8E2D5",
                    }}
                  >
                    <button
                      onClick={() => setPreview(item)}
                      title="Xem nội dung chi tiết"
                      style={{
                        padding: "10px",
                        border: "1px solid #E8E2D5",
                        borderRadius: "10px",
                        background: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#7A7A7A",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#B89047";
                        e.currentTarget.style.color = "#B89047";
                        e.currentTarget.style.backgroundColor = "#FAF6F0";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E8E2D5";
                        e.currentTarget.style.color = "#7A7A7A";
                        e.currentTarget.style.backgroundColor = "white";
                      }}
                    >
                      <Eye size={16} />
                    </button>

                    {item.moderationStatus === "PENDING_REVIEW" && (
                      <>
                        <button
                          disabled={actionId === item._id}
                          onClick={() => void moderate(item, "APPROVED")}
                          style={{
                            flex: 1,
                            border: "none",
                            borderRadius: "10px",
                            color: "white",
                            background: "#166534",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: "12.5px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            boxShadow: "0 4px 10px rgba(22, 101, 52, 0.15)",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#155d30";
                            e.currentTarget.style.transform = "scale(1.02)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#166534";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          <Check size={14} /> Duyệt
                        </button>
                        <button
                          disabled={actionId === item._id}
                          onClick={() => void moderate(item, "REJECTED")}
                          style={{
                            flex: 1,
                            border: "none",
                            borderRadius: "10px",
                            color: "white",
                            background: "#991B1B",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: "12.5px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            boxShadow: "0 4px 10px rgba(153, 27, 27, 0.15)",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#8a1616";
                            e.currentTarget.style.transform = "scale(1.02)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#991B1B";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          <X size={14} /> Từ chối
                        </button>
                      </>
                    )}

                    {item.moderationStatus === "APPROVED" && (
                      <button
                        disabled={actionId === item._id}
                        onClick={() => void moderate(item, "HIDDEN")}
                        style={{
                          flex: 1,
                          border: "1px solid #E57373",
                          borderRadius: "10px",
                          color: "#C62828",
                          background: "#FFEBEE",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: "12.5px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#FFCDD2";
                          e.currentTarget.style.color = "#B71C1C";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#FFEBEE";
                          e.currentTarget.style.color = "#C62828";
                        }}
                      >
                        <EyeOff size={14} /> Ẩn sản phẩm
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modern Backdrop-blur Modal Preview */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            animation: "fadeInModal 0.2s ease",
          }}
        >
          <div
            style={{
              width: "min(760px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
              background: "white",
              borderRadius: "20px",
              padding: "28px",
              position: "relative",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <button
              onClick={() => setPreview(null)}
              title="Đóng"
              style={{
                position: "absolute",
                right: "20px",
                top: "20px",
                border: "none",
                background: "rgba(0, 0, 0, 0.05)",
                cursor: "pointer",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(74, 14, 23, 0.1)";
                e.currentTarget.style.color = "#4A0E17";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
                e.currentTarget.style.color = "black";
              }}
            >
              <X size={18} />
            </button>

            <div>
              <span
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  color: "#B89047",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Chi tiết sản phẩm kiểm duyệt
              </span>
              <h3
                style={{
                  marginTop: 0,
                  paddingRight: "40px",
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#4A0E17",
                  fontFamily: "serif",
                }}
              >
                {preview.name}
              </h3>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "13.5px",
                color: "#4A4A4A",
                borderTop: "1px solid #E8E2D5",
                paddingTop: "16px",
              }}
            >
              <strong style={{ color: "#2A2A2A" }}>Mô tả sản phẩm:</strong>
              <p
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  backgroundColor: "#FAF6F0",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #E8E2D5",
                  color: "#4A4A4A",
                }}
              >
                {preview.description ||
                  "Không có mô tả chi tiết từ người đăng."}
              </p>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <strong style={{ fontSize: "13.5px", color: "#2A2A2A" }}>
                Hình ảnh sản phẩm ({preview.images?.length || 0}):
              </strong>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "12px",
                }}
              >
                {preview.images && preview.images.length > 0 ? (
                  preview.images.map((image, idx) => (
                    <a
                      key={idx}
                      href={resolveImageUrl(image)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "block",
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: "1px solid #E8E2D5",
                        height: "130px",
                        transition: "transform 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "scale(1.03)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "scale(1)")
                      }
                    >
                      <img
                        src={resolveImageUrl(image)}
                        onError={(event) => {
                          event.currentTarget.src = fallbackImage;
                        }}
                        alt={`Ảnh chi tiết ${idx + 1}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </a>
                  ))
                ) : (
                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#7A7A7A",
                      fontStyle: "italic",
                      gridColumn: "1 / -1",
                    }}
                  >
                    Không có hình ảnh đính kèm.
                  </div>
                )}
              </div>
            </div>

            <AdminSmartTagPanel entityType="PRODUCT" entityId={preview._id} />

            {/* Quick action buttons in modal */}
            {preview.moderationStatus === "PENDING_REVIEW" && (
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  borderTop: "1px solid #E8E2D5",
                  paddingTop: "20px",
                  marginTop: "10px",
                }}
              >
                <button
                  onClick={() => void moderate(preview, "APPROVED")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#166534",
                    color: "white",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13.5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <Check size={16} /> Phê duyệt sản phẩm
                </button>
                <button
                  onClick={() => void moderate(preview, "REJECTED")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#991B1B",
                    color: "white",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13.5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <X size={16} /> Từ chối phê duyệt
                </button>
              </div>
            )}
          </div>
          <style>{`
            @keyframes fadeInModal {
              from { opacity: 0; transform: scale(0.97); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

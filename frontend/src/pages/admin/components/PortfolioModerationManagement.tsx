import React, { useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  Search,
  User,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import Swal from "sweetalert2";
import { httpClient } from "../../../services/httpClient";
import { useToast } from "../../../components/feedback/Toast";
import { API_BASE_URL } from "../../../config/env";
import { AdminSmartTagPanel } from "../../../features/smart-tagging/components/AdminSmartTagPanel";

type Status = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "HIDDEN";

interface Item {
  _id: string;
  title: string;
  description?: string;
  images: string[];
  moderationStatus: Status;
  moderationReason?: string;
  providerId?: { businessName?: string };
}

const labels: Record<Status, string> = {
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  HIDDEN: "Đã ẩn",
};

const fallbackImage =
  "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800";
const resolveImageUrl = (url?: string) =>
  !url || url.startsWith("http")
    ? url || fallbackImage
    : `${API_BASE_URL}${url}`;

export const PortfolioModerationManagement: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status>("PENDING_REVIEW");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Item | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const load = async (nextStatus = status) => {
    setLoading(true);
    try {
      setItems(
        (await httpClient.get<Item[]>(
          `/admin/portfolio-items/moderation?status=${nextStatus}`,
        )) || [],
      );
    } catch (err: any) {
      toast.error(
        err.message || "Không thể tải danh sách kiểm duyệt portfolio",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const action = async (
    item: Item,
    next: "APPROVED" | "REJECTED" | "HIDDEN",
  ) => {
    const reasonRequired = next !== "APPROVED";
    const result = await Swal.fire({
      title:
        next === "APPROVED"
          ? "Duyệt portfolio?"
          : next === "REJECTED"
            ? "Từ chối portfolio?"
            : "Ẩn portfolio?",
      input: reasonRequired ? "textarea" : undefined,
      inputLabel: reasonRequired ? "Lý do *" : undefined,
      showCancelButton: true,
      confirmButtonText: "Xác nhận",
      cancelButtonText: "Quay lại",
      confirmButtonColor: next === "APPROVED" ? "#166534" : "#991B1B",
      inputValidator: (value: string) =>
        reasonRequired && !value?.trim() ? "Vui lòng nhập lý do" : undefined,
    });

    if (!result.isConfirmed) return;

    setActionId(item._id);
    try {
      await httpClient.patch(`/admin/portfolio-items/${item._id}/moderation`, {
        action: next,
        ...(reasonRequired ? { reason: result.value.trim() } : {}),
      });
      toast.success("Đã cập nhật trạng thái portfolio");
      await load();
      if (preview?._id === item._id) setPreview(null);
    } catch (err: any) {
      toast.error(err.message || "Không thể xử lý portfolio");
      await load();
    } finally {
      setActionId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    const titleMatch = item.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const descMatch = (item.description || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const providerMatch = (item.providerId?.businessName || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return titleMatch || descMatch || providerMatch;
  });

  const getStatusBadgeStyle = (moderationStatus: Status) => {
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
    <section
      style={{
        marginTop: "36px",
        borderTop: "2px dashed #E8E2D5",
        paddingTop: "32px",
      }}
    >
      {/* Portfolio Title */}
      <div style={{ marginBottom: "20px" }}>
        <h3
          style={{
            margin: 0,
            color: "#4A0E17",
            fontSize: "18px",
            fontFamily: "serif",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Kiểm duyệt hồ sơ năng lực (Portfolio)
        </h3>
        <p style={{ margin: "4px 0 0", color: "#7A7A7A", fontSize: "13px" }}>
          Xem và phê duyệt các album ảnh của nhiếp ảnh gia / studio đăng tải lên
          thư viện.
        </p>
      </div>

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
          marginBottom: "24px",
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
            }}
          >
            <Search size={18} color="#7A7A7A" />
            <input
              type="text"
              placeholder="Tìm kiếm portfolio theo tiêu đề, nhiếp ảnh gia..."
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

        {/* Status Filters */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {(
            ["PENDING_REVIEW", "APPROVED", "REJECTED", "HIDDEN"] as Status[]
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
                  backgroundColor: isActive ? "#706E3B" : "white", // Olive green for portfolio tab
                  color: isActive ? "white" : "#7A7A7A",
                  transition: "all 0.2s ease",
                  boxShadow: isActive
                    ? "0 4px 12px rgba(112, 110, 59, 0.15)"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = "#FAF6F0";
                    e.currentTarget.style.color = "#706E3B";
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

          <button
            onClick={() => void load()}
            disabled={loading}
            title="Tải lại danh sách"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              border: "1px solid #E8E2D5",
              borderRadius: "10px",
              padding: "10px 14px",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
              color: "#7A7A7A",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#B89047";
              e.currentTarget.style.color = "#706E3B";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E8E2D5";
              e.currentTarget.style.color = "#7A7A7A";
            }}
          >
            <RefreshCw size={15} className={loading ? "spin-anim" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "200px",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              border: "3px solid #E8E2D5",
              borderTop: "3px solid #706E3B",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              animation: "spin 1s linear infinite",
            }}
          />
          <span style={{ fontSize: "14px", color: "#7A7A7A", fontWeight: 600 }}>
            Đang tải danh sách portfolio...
          </span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            padding: "48px 32px",
            textAlign: "center",
            color: "#7A7A7A",
            border: "1px solid #E8E2D5",
            borderRadius: "16px",
            backgroundColor: "white",
          }}
        >
          <AlertCircle
            size={28}
            color="#B89047"
            style={{ marginBottom: "10px" }}
          />
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
            Không có album portfolio nào ở trạng thái này.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(285px, 1fr))",
            gap: "20px",
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
                    ? "0 12px 25px rgba(112, 110, 59, 0.08)"
                    : "0 4px 15px rgba(0, 0, 0, 0.02)",
                  transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {/* Image Wrapper */}
                <div
                  style={{
                    height: "170px",
                    background: "#FAF6F0",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={resolveImageUrl(item.images[0])}
                    onError={(event) => {
                      event.currentTarget.src = fallbackImage;
                    }}
                    alt={item.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: isHovered ? "scale(1.05)" : "scale(1)",
                      transition: "transform 0.4s ease",
                    }}
                  />
                  {/* Status Badge */}
                  <span
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      padding: "4px 8px",
                      borderRadius: "5px",
                      fontSize: "10px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      backdropFilter: "blur(4px)",
                      ...getStatusBadgeStyle(item.moderationStatus),
                    }}
                  >
                    {labels[item.moderationStatus]}
                  </span>
                </div>

                {/* Content Section */}
                <div
                  style={{
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    flex: 1,
                  }}
                >
                  <strong
                    style={{
                      color: "#2A2A2A",
                      fontSize: "14px",
                      lineHeight: 1.4,
                      fontWeight: 700,
                      minHeight: "38px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.title}
                  </strong>

                  {/* Provider Info */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      color: "#7A7A7A",
                    }}
                  >
                    <User size={13} color="#B89047" />
                    <span style={{ fontWeight: 600 }}>
                      {item.providerId?.businessName || "Nhà cung cấp"}
                    </span>
                  </div>

                  {/* Description snippet */}
                  {item.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "#666",
                        lineHeight: "1.45",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.description}
                    </p>
                  )}

                  {/* Rejection / Hidden reasons */}
                  {item.moderationReason && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#991B1B",
                        background: "#FEF2F2",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #FEE2E2",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "4px",
                      }}
                    >
                      <AlertCircle
                        size={14}
                        style={{ marginTop: "1px", flexShrink: 0 }}
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
                      paddingTop: "10px",
                      borderTop: "1px dashed #E8E2D5",
                    }}
                  >
                    <button
                      onClick={() => setPreview(item)}
                      title="Xem toàn bộ album"
                      style={{
                        padding: "8px 10px",
                        border: "1px solid #E8E2D5",
                        borderRadius: "8px",
                        background: "white",
                        cursor: "pointer",
                        color: "#7A7A7A",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#B89047";
                        e.currentTarget.style.color = "#706E3B";
                        e.currentTarget.style.backgroundColor = "#FAF6F0";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E8E2D5";
                        e.currentTarget.style.color = "#7A7A7A";
                        e.currentTarget.style.backgroundColor = "white";
                      }}
                    >
                      <Eye size={15} />
                    </button>

                    {item.moderationStatus === "PENDING_REVIEW" && (
                      <>
                        <button
                          disabled={actionId === item._id}
                          onClick={() => void action(item, "APPROVED")}
                          style={{
                            flex: 1,
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                            background: "#166534",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#155d30";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#166534";
                          }}
                        >
                          <Check size={13} /> Duyệt
                        </button>
                        <button
                          disabled={actionId === item._id}
                          onClick={() => void action(item, "REJECTED")}
                          style={{
                            flex: 1,
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                            background: "#991B1B",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#8a1616";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#991B1B";
                          }}
                        >
                          <X size={13} /> Từ chối
                        </button>
                      </>
                    )}

                    {item.moderationStatus === "APPROVED" && (
                      <button
                        disabled={actionId === item._id}
                        onClick={() => void action(item, "HIDDEN")}
                        style={{
                          flex: 1,
                          border: "1px solid #E57373",
                          borderRadius: "8px",
                          color: "#C62828",
                          background: "#FFEBEE",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#FFCDD2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#FFEBEE";
                        }}
                      >
                        <EyeOff size={13} /> Ẩn portfolio
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
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
                Chi tiết Portfolio kiểm duyệt
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
                {preview.title}
              </h3>
              <span
                style={{
                  fontSize: "13px",
                  color: "#7A7A7A",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  marginTop: "4px",
                }}
              >
                <User size={14} color="#B89047" /> Đăng tải bởi:{" "}
                <strong>
                  {preview.providerId?.businessName || "Nhà cung cấp"}
                </strong>
              </span>
            </div>

            {preview.description && (
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
                <strong style={{ color: "#2A2A2A" }}>Mô tả:</strong>
                <p
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                    backgroundColor: "#FAF6F0",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #E8E2D5",
                  }}
                >
                  {preview.description}
                </p>
              </div>
            )}

            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <strong
                style={{
                  fontSize: "13.5px",
                  color: "#2A2A2A",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ImageIcon size={16} color="#706E3B" /> Danh sách ảnh trong
                album ({preview.images?.length || 0}):
              </strong>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "12px",
                }}
              >
                {preview.images.map((image, idx) => (
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
                      alt={`Ảnh portfolio ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>

            <AdminSmartTagPanel entityType="PORTFOLIO" entityId={preview._id} />

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
                  onClick={() => void action(preview, "APPROVED")}
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
                  <Check size={16} /> Phê duyệt album
                </button>
                <button
                  onClick={() => void action(preview, "REJECTED")}
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
        </div>
      )}
    </section>
  );
};

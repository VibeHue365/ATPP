import React, { useCallback, useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { smartTagService } from "../services/smartTagService";
import type {
  SmartTagAssignment,
  SmartTagDecisionAction,
  SmartTagDefinition,
} from "../types/smartTag.types";

interface Props {
  productId?: string;
  initialDecisionVersion?: number;
}

const statusLabel: Record<SmartTagAssignment["status"], string> = {
  SUGGESTED: "Gợi ý",
  ACTIVE: "Đã chọn",
  REJECTED: "Đã từ chối",
  REMOVED: "Đã gỡ",
  STALE: "Cần tạo lại",
};

export const SmartTagEditor: React.FC<Props> = ({
  productId,
  initialDecisionVersion = 0,
}) => {
  const [assignments, setAssignments] = useState<SmartTagAssignment[]>([]);
  const [taxonomy, setTaxonomy] = useState<SmartTagDefinition[]>([]);
  const [decisionVersion, setDecisionVersion] = useState(
    initialDecisionVersion,
  );
  const [loading, setLoading] = useState(Boolean(productId));
  const [generating, setGenerating] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextAssignments, nextTaxonomy] = await Promise.all([
        smartTagService.list(productId),
        smartTagService.listTaxonomy(productId),
      ]);
      setAssignments(nextAssignments);
      setTaxonomy(nextTaxonomy);
      setSelectedCodes(
        nextAssignments
          .filter((assignment) => assignment.status === "ACTIVE")
          .map((assignment) => assignment.tagCode),
      );
    } catch (requestError: any) {
      setError(requestError.message || "Không thể tải thẻ thông minh.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    setDecisionVersion(initialDecisionVersion);
  }, [initialDecisionVersion, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    if (!productId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      await smartTagService.generate(productId);
      await load();
    } catch (requestError: any) {
      setError(requestError.message || "Không thể tạo gợi ý lúc này.");
    } finally {
      setGenerating(false);
    }
  };

  const decide = async (
    assignment: SmartTagAssignment,
    action: SmartTagDecisionAction,
  ) => {
    if (!productId) return;
    const requiresReason = action === "REJECT" || action === "REMOVE";
    const reason = requiresReason
      ? window.prompt("Nhập lý do:")?.trim()
      : undefined;
    if (requiresReason && !reason) return;

    try {
      await smartTagService.decide(
        productId,
        assignment.tagCode,
        action,
        decisionVersion,
        reason,
      );
      setDecisionVersion((version) => version + 1);
      await load();
    } catch (requestError: any) {
      setError(
        requestError.message ||
          "Thao tác thẻ không thành công. Vui lòng tải lại.",
      );
    }
  };

  const saveSelection = async () => {
    if (!productId || savingSelection) return;
    setSavingSelection(true);
    try {
      const nextAssignments = await smartTagService.select(
        productId,
        selectedCodes,
        decisionVersion,
      );
      setAssignments(nextAssignments);
      setDecisionVersion((version) => version + 1);
    } catch (requestError: any) {
      setError(
        requestError.message || "Không thể lưu lựa chọn. Vui lòng tải lại.",
      );
    } finally {
      setSavingSelection(false);
    }
  };

  if (!productId) {
    return (
      <section style={panelStyle}>
        <strong>Thẻ thông minh</strong>
        <p style={hintStyle}>
          Lưu áo dài trước để tạo gợi ý thẻ từ thông tin sản phẩm.
        </p>
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <div>
          <strong>Thẻ thông minh</strong>
          <p style={hintStyle}>
            Gợi ý dựa trên kiểu dáng, chất liệu, dịp sử dụng và mô tả sản phẩm.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating || loading}
          style={primaryButtonStyle}
        >
          <Sparkles size={15} />
          {generating ? "Đang tạo..." : "Tạo gợi ý"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#b91c1c", fontSize: "12px", margin: "10px 0 0" }}>
          {error}
        </p>
      )}
      {loading ? (
        <p style={hintStyle}>Đang tải thẻ thông minh...</p>
      ) : (
        <>
          {assignments.length === 0 && (
            <p style={hintStyle}>
              Chưa có gợi ý. Bạn có thể tạo gợi ý hoặc chọn thủ công.
            </p>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            {assignments.map((assignment) => (
              <div key={assignment._id} style={assignmentStyle}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: "13px" }}>
                    {assignment.definition?.label || assignment.tagCode}
                  </strong>
                  <span
                    style={{
                      ...statusStyle,
                      color: statusColor(assignment.status),
                    }}
                  >
                    {statusLabel[assignment.status]}
                  </span>
                  <p style={{ ...hintStyle, margin: "3px 0 0" }}>
                    {assignment.signals[0]?.source === "MANUAL"
                      ? "Provider chọn thủ công"
                      : "Gợi ý theo dữ liệu sản phẩm"}
                    {assignment.signals[0]?.confidence
                      ? ` · ${Math.round(assignment.signals[0].confidence * 100)}%`
                      : ""}
                  </p>
                  {assignment.decisionReason && (
                    <p style={{ ...hintStyle, margin: "3px 0 0" }}>
                      Lý do: {assignment.decisionReason}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {assignment.status === "SUGGESTED" && (
                    <>
                      <button
                        type="button"
                        aria-label="Chấp nhận thẻ"
                        onClick={() => decide(assignment, "ACTIVATE")}
                        style={iconButtonStyle}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Từ chối thẻ"
                        onClick={() => decide(assignment, "REJECT")}
                        style={dangerIconButtonStyle}
                      >
                        <X size={15} />
                      </button>
                    </>
                  )}
                  {assignment.status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => decide(assignment, "REMOVE")}
                      style={secondaryButtonStyle}
                    >
                      Gỡ
                    </button>
                  )}
                  {(assignment.status === "REJECTED" ||
                    assignment.status === "REMOVED") && (
                    <button
                      type="button"
                      onClick={() => decide(assignment, "RESTORE")}
                      style={secondaryButtonStyle}
                    >
                      Chọn lại
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {taxonomy.length > 0 && (
            <div
              style={{
                marginTop: "14px",
                borderTop: "1px solid #e7e5e4",
                paddingTop: "12px",
              }}
            >
              <p style={{ ...hintStyle, margin: "0 0 8px" }}>
                Chọn thủ công ({selectedCodes.length} thẻ đã chọn)
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                {taxonomy.map((definition) => {
                  const selected = selectedCodes.includes(definition.code);
                  return (
                    <button
                      key={definition.code}
                      type="button"
                      title={definition.description}
                      onClick={() =>
                        setSelectedCodes((codes) =>
                          selected
                            ? codes.filter((code) => code !== definition.code)
                            : [...codes, definition.code],
                        )
                      }
                      style={{
                        ...tagToggleStyle,
                        borderColor: selected
                          ? definition.displayConfig.color
                          : "#d6d3d1",
                        backgroundColor: selected
                          ? definition.displayConfig.backgroundColor
                          : "white",
                        color: selected
                          ? definition.displayConfig.color
                          : "#57534e",
                      }}
                    >
                      {selected && <Check size={13} />}
                      {definition.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={saveSelection}
                disabled={savingSelection || selectedCodes.length === 0}
                style={{
                  ...secondaryButtonStyle,
                  marginTop: "10px",
                  opacity: selectedCodes.length === 0 ? 0.55 : 1,
                  cursor: selectedCodes.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {savingSelection
                  ? "Đang lưu..."
                  : selectedCodes.length === 0
                    ? "Chọn ít nhất một thẻ"
                    : "Lưu lựa chọn"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #e7e5e4",
  borderRadius: "8px",
  padding: "14px",
  background: "#fffdf9",
};
const hintStyle: React.CSSProperties = {
  color: "#78716c",
  fontSize: "12px",
  lineHeight: 1.45,
  margin: "4px 0 0",
};
const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  border: "none",
  borderRadius: "6px",
  padding: "8px 11px",
  background: "var(--color-primary)",
  color: "white",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d6d3d1",
  borderRadius: "6px",
  padding: "6px 9px",
  background: "white",
  color: "#44403c",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
};
const iconButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: "#166534",
  borderColor: "#86efac",
  display: "inline-flex",
  padding: "6px",
};
const dangerIconButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: "#b91c1c",
  borderColor: "#fecaca",
  display: "inline-flex",
  padding: "6px",
};
const assignmentStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px",
  border: "1px solid #ede9e3",
  borderRadius: "6px",
  background: "white",
};
const statusStyle: React.CSSProperties = {
  display: "inline-block",
  marginLeft: "7px",
  fontSize: "11px",
  fontWeight: 700,
};
const tagToggleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  border: "1px solid",
  borderRadius: "999px",
  padding: "5px 9px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
};

function statusColor(status: SmartTagAssignment["status"]) {
  return status === "ACTIVE"
    ? "#166534"
    : status === "SUGGESTED"
      ? "#a16207"
      : "#78716c";
}


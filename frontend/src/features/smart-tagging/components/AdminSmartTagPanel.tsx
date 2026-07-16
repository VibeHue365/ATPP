import React, { useCallback, useEffect, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { httpClient } from "../../../services/httpClient";
import type {
  SmartTagAssignment,
  SmartTagDecisionAction,
} from "../types/smartTag.types";

interface Props {
  entityType: "PRODUCT" | "PORTFOLIO";
  entityId: string;
}

interface AdminTagState {
  taggingDecisionVersion: number;
  assignments: SmartTagAssignment[];
}

export const AdminSmartTagPanel: React.FC<Props> = ({
  entityType,
  entityId,
}) => {
  const [state, setState] = useState<AdminTagState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(
        await httpClient.get<AdminTagState>(
          `/admin/smart-tags/${entityType}/${entityId}`,
        ),
      );
      setError(null);
    } catch (requestError: any) {
      setError(requestError.message || "Không thể tải thẻ thông minh.");
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    assignment: SmartTagAssignment,
    action: SmartTagDecisionAction,
  ) => {
    if (!state) return;
    const requiresReason = action === "REJECT" || action === "REMOVE";
    const reason = requiresReason
      ? window.prompt("Nhập lý do:")?.trim()
      : undefined;
    if (requiresReason && !reason) return;
    try {
      await httpClient.post(
        `/admin/smart-tags/${entityType}/${entityId}/${assignment.tagCode}/decision`,
        {
          action,
          expectedDecisionVersion: state.taggingDecisionVersion,
          reason,
        },
      );
      await load();
    } catch (requestError: any) {
      setError(requestError.message || "Thẻ đã thay đổi. Vui lòng tải lại.");
    }
  };

  return (
    <section style={{ borderTop: "1px solid #e7e5e4", paddingTop: "14px" }}>
      <strong style={{ fontSize: "13px", color: "#44403c" }}>
        Thẻ thông minh
      </strong>
      {loading && <p style={hintStyle}>Đang tải thẻ...</p>}
      {error && <p style={{ ...hintStyle, color: "#b91c1c" }}>{error}</p>}
      {!loading && state?.assignments.length === 0 && (
        <p style={hintStyle}>Nội dung này chưa có tag.</p>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "7px",
          marginTop: "8px",
        }}
      >
        {state?.assignments.map((assignment) => (
          <div
            key={assignment._id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              padding: "8px 10px",
              border: "1px solid #e7e5e4",
              borderRadius: "6px",
            }}
          >
            <div>
              <strong style={{ fontSize: "12px" }}>
                {assignment.definition?.label || assignment.tagCode}
              </strong>
              <p style={{ ...hintStyle, margin: "2px 0 0" }}>
                {assignment.status} · {assignment.signals[0]?.source || "RULE"}
                {assignment.signals[0]?.confidence
                  ? ` · ${Math.round(assignment.signals[0].confidence * 100)}%`
                  : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: "5px" }}>
              {assignment.status === "SUGGESTED" && (
                <>
                  <button
                    type="button"
                    title="Kích hoạt"
                    onClick={() => decide(assignment, "ACTIVATE")}
                    style={iconButton}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    title="Từ chối"
                    onClick={() => decide(assignment, "REJECT")}
                    style={{
                      ...iconButton,
                      color: "#b91c1c",
                      borderColor: "#fecaca",
                    }}
                  >
                    <X size={14} />
                  </button>
                </>
              )}
              {assignment.status === "ACTIVE" && (
                <button
                  type="button"
                  title="Gỡ tag"
                  onClick={() => decide(assignment, "REMOVE")}
                  style={{
                    ...iconButton,
                    color: "#b91c1c",
                    borderColor: "#fecaca",
                  }}
                >
                  <X size={14} />
                </button>
              )}
              {(assignment.status === "REJECTED" ||
                assignment.status === "REMOVED") && (
                <button
                  type="button"
                  title="Khôi phục tag"
                  onClick={() => decide(assignment, "RESTORE")}
                  style={iconButton}
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const hintStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#78716c",
  margin: "6px 0 0",
  lineHeight: 1.4,
};
const iconButton: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid #86efac",
  borderRadius: "5px",
  padding: "5px",
  background: "white",
  color: "#166534",
  cursor: "pointer",
};

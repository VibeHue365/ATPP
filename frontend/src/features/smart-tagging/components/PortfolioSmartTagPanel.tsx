import React, { useCallback, useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { httpClient } from "../../../services/httpClient";
import type {
  SmartTagAssignment,
  SmartTagDecisionAction,
  SmartTagDefinition,
} from "../types/smartTag.types";

interface Props {
  itemId: string;
  initialDecisionVersion?: number;
}

const endpoint = (itemId: string) =>
  `/provider/portfolio-items/${itemId}/smart-tags`;

export const PortfolioSmartTagPanel: React.FC<Props> = ({
  itemId,
  initialDecisionVersion = 0,
}) => {
  const [assignments, setAssignments] = useState<SmartTagAssignment[]>([]);
  const [taxonomy, setTaxonomy] = useState<SmartTagDefinition[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [decisionVersion, setDecisionVersion] = useState(
    initialDecisionVersion,
  );
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAssignments, nextTaxonomy] = await Promise.all([
        httpClient.get<SmartTagAssignment[]>(endpoint(itemId)),
        httpClient.get<SmartTagDefinition[]>(`${endpoint(itemId)}/taxonomy`),
      ]);
      setAssignments(nextAssignments);
      setTaxonomy(nextTaxonomy);
      setSelectedCodes(
        nextAssignments
          .filter((item) => item.status === "ACTIVE")
          .map((item) => item.tagCode),
      );
      setError(null);
    } catch (requestError: any) {
      setError(requestError.message || "Không thể tải thẻ.");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    setDecisionVersion(initialDecisionVersion);
    void load();
  }, [initialDecisionVersion, load]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await httpClient.post(`${endpoint(itemId)}/generate`);
      await load();
    } catch (requestError: any) {
      setError(requestError.message || "Không thể tạo gợi ý.");
    } finally {
      setGenerating(false);
    }
  };

  const decide = async (
    assignment: SmartTagAssignment,
    action: SmartTagDecisionAction,
  ) => {
    const reason =
      action === "REJECT" || action === "REMOVE"
        ? window.prompt("Nhập lý do từ chối:")?.trim()
        : undefined;
    if ((action === "REJECT" || action === "REMOVE") && !reason) return;
    try {
      await httpClient.post(
        `${endpoint(itemId)}/${assignment.tagCode}/decision`,
        {
          action,
          expectedDecisionVersion: decisionVersion,
          reason,
        },
      );
      setDecisionVersion((version) => version + 1);
      await load();
    } catch (requestError: any) {
      setError(
        requestError.message || "Thao tác không thành công. Vui lòng tải lại.",
      );
    }
  };

  const saveSelection = async () => {
    try {
      const nextAssignments = await httpClient.post<SmartTagAssignment[]>(
        `${endpoint(itemId)}/selection`,
        {
          activeTagCodes: selectedCodes,
          expectedDecisionVersion: decisionVersion,
        },
      );
      setAssignments(nextAssignments);
      setDecisionVersion((version) => version + 1);
      setError(null);
    } catch (requestError: any) {
      setError(
        requestError.message || "Không thể lưu lựa chọn. Vui lòng tải lại.",
      );
    }
  };

  return (
    <div
      style={{
        padding: "10px",
        borderTop: "1px solid #e7e5e4",
        background: "#fffdf9",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <strong style={{ fontSize: "12px" }}>Thẻ thông minh</strong>
        <button
          type="button"
          onClick={generate}
          disabled={generating || loading}
          style={buttonStyle}
        >
          <Sparkles size={13} />
          {generating ? "Đang tạo" : "Tạo gợi ý"}
        </button>
      </div>
      {error && (
        <p style={{ margin: "7px 0 0", color: "#b91c1c", fontSize: "11px" }}>
          {error}
        </p>
      )}
      {!loading &&
        assignments
          .filter((item) => item.status === "SUGGESTED")
          .map((assignment) => (
            <div
              key={assignment._id}
              style={{
                display: "flex",
                gap: "6px",
                alignItems: "center",
                marginTop: "8px",
              }}
            >
              <span style={{ fontSize: "12px", flex: 1 }}>
                {assignment.definition?.label || assignment.tagCode}
              </span>
              <button
                type="button"
                onClick={() => decide(assignment, "ACTIVATE")}
                aria-label="Chấp nhận thẻ"
                style={iconButtonStyle}
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onClick={() => decide(assignment, "REJECT")}
                aria-label="Từ chối thẻ"
                style={{
                  ...iconButtonStyle,
                  color: "#b91c1c",
                  borderColor: "#fecaca",
                }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
      {!loading &&
        assignments
          .filter((item) => item.status === "ACTIVE")
          .map((assignment) => (
            <div
              key={`${assignment._id}-active`}
              style={{
                display: "flex",
                gap: "6px",
                alignItems: "center",
                marginTop: "8px",
              }}
            >
              <span style={{ fontSize: "12px", flex: 1 }}>
                {assignment.definition?.label || assignment.tagCode}
              </span>
              <button
                type="button"
                onClick={() => decide(assignment, "REMOVE")}
                style={{
                  ...iconButtonStyle,
                  color: "#b91c1c",
                  borderColor: "#fecaca",
                }}
              >
                Gỡ
              </button>
            </div>
          ))}
      {!loading &&
        assignments
          .filter(
            (item) => item.status === "REJECTED" || item.status === "REMOVED",
          )
          .map((assignment) => (
            <div
              key={`${assignment._id}-restore`}
              style={{
                display: "flex",
                gap: "6px",
                alignItems: "center",
                marginTop: "8px",
              }}
            >
              <span style={{ fontSize: "12px", flex: 1 }}>
                {assignment.definition?.label || assignment.tagCode}
              </span>
              <button
                type="button"
                onClick={() => decide(assignment, "RESTORE")}
                style={iconButtonStyle}
              >
                Chọn lại
              </button>
            </div>
          ))}
      {!loading &&
        assignments.filter((item) => item.status === "ACTIVE").length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "5px",
              marginTop: "8px",
            }}
          >
            {assignments
              .filter((item) => item.status === "ACTIVE")
              .map((assignment) => (
                <span
                  key={assignment._id}
                  title={assignment.definition?.description}
                  style={{
                    padding: "3px 7px",
                    borderRadius: "999px",
                    background:
                      assignment.definition?.displayConfig.backgroundColor ||
                      "#f5f5f4",
                    color:
                      assignment.definition?.displayConfig.color || "#57534e",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {assignment.definition?.label || assignment.tagCode}
                </span>
              ))}
          </div>
        )}
      {!loading && taxonomy.length > 0 && (
        <div
          style={{
            borderTop: "1px solid #e7e5e4",
            marginTop: "10px",
            paddingTop: "9px",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#78716c" }}>
            Chọn thủ công
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
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
                    padding: "4px 7px",
                    borderRadius: "999px",
                    border: `1px solid ${selected ? definition.displayConfig.color : "#d6d3d1"}`,
                    background: selected
                      ? definition.displayConfig.backgroundColor
                      : "white",
                    color: selected
                      ? definition.displayConfig.color
                      : "#57534e",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {selected && "✓ "}
                  {definition.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={saveSelection}
            style={{ ...buttonStyle, marginTop: "8px" }}
          >
            Lưu lựa chọn
          </button>
        </div>
      )}
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  border: "1px solid var(--color-primary)",
  borderRadius: "5px",
  padding: "5px 7px",
  background: "white",
  color: "var(--color-primary)",
  fontSize: "11px",
  fontWeight: 700,
  cursor: "pointer",
};
const iconButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "4px",
  borderRadius: "4px",
  border: "1px solid #86efac",
  background: "white",
  color: "#166534",
  cursor: "pointer",
};

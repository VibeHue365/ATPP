import React from "react";
import type { PublicSmartTagBadge } from "../types/smartTag.types";

export const SmartTagBadge: React.FC<{ badge: PublicSmartTagBadge }> = ({
  badge,
}) => (
  <span
    title={badge.description}
    style={{
      display: "inline-flex",
      alignItems: "center",
      maxWidth: "100%",
      padding: "3px 8px",
      borderRadius: "999px",
      backgroundColor: badge.displayConfig.backgroundColor,
      color: badge.displayConfig.color,
      fontSize: "11px",
      fontWeight: 700,
      lineHeight: 1.35,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }}
  >
    {badge.label}
  </span>
);

import React from "react";
import { SmartTagBadge } from "./SmartTagBadge";
import type { PublicSmartTagBadge } from "../types/smartTag.types";

export const SmartTagList: React.FC<{
  badges?: PublicSmartTagBadge[];
  limit?: number;
}> = ({ badges = [], limit }) => {
  const visibleBadges = limit ? badges.slice(0, limit) : badges;
  if (!visibleBadges.length) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {visibleBadges.map((badge) => (
        <SmartTagBadge key={badge.code} badge={badge} />
      ))}
    </div>
  );
};

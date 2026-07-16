import { httpClient } from "../../../services/httpClient";
import type {
  SmartTagAssignment,
  SmartTagDecisionAction,
  SmartTagDefinition,
} from "../types/smartTag.types";

const endpoint = (productId: string) =>
  `/provider/products/${productId}/smart-tags`;

export const smartTagService = {
  list: (productId: string) =>
    httpClient.get<SmartTagAssignment[]>(endpoint(productId)),
  listTaxonomy: (productId: string) =>
    httpClient.get<SmartTagDefinition[]>(`${endpoint(productId)}/taxonomy`),
  generate: (productId: string) =>
    httpClient.post(`${endpoint(productId)}/generate`),
  decide: (
    productId: string,
    tagCode: string,
    action: SmartTagDecisionAction,
    expectedDecisionVersion: number,
    reason?: string,
  ) =>
    httpClient.post(`${endpoint(productId)}/${tagCode}/decision`, {
      action,
      expectedDecisionVersion,
      reason,
    }),
  select: (
    productId: string,
    activeTagCodes: string[],
    expectedDecisionVersion: number,
  ) =>
    httpClient.post<SmartTagAssignment[]>(`${endpoint(productId)}/selection`, {
      activeTagCodes,
      expectedDecisionVersion,
    }),
};

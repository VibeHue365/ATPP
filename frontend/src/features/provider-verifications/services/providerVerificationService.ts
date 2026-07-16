import { httpClient } from "../../../services/httpClient";
import type {
  AodaiInfo,
  CreateProviderVerificationResponse,
  PhotographyInfo,
  ProviderBusinessProfile,
  ProviderCapability,
  ProviderDocumentType,
  ProviderVerificationDetail,
} from "../types";

export const providerVerificationService = {
  create(requestedCapabilities: ProviderCapability[]) {
    return httpClient.post<CreateProviderVerificationResponse>(
      "/provider-verifications",
      { requestedCapabilities },
    );
  },

  getCurrent() {
    return httpClient.get<ProviderVerificationDetail | null>(
      "/provider-verifications/me/current",
    );
  },

  getById(id: string) {
    return httpClient.get<ProviderVerificationDetail>(
      `/provider-verifications/${id}`,
    );
  },

  update(
    id: string,
    payload: {
      businessProfile?: ProviderBusinessProfile;
      aodaiInfo?: AodaiInfo;
      photographyInfo?: PhotographyInfo;
      requestedCapabilities?: ProviderCapability[];
    },
  ) {
    return httpClient.patch<ProviderVerificationDetail>(
      `/provider-verifications/${id}`,
      payload,
    );
  },

  acceptConsent(id: string, version = "provider-verification-consent-v1") {
    return httpClient.post<{ accepted: boolean; acceptedAt: string }>(
      `/provider-verifications/${id}/consent`,
      { version },
    );
  },

  uploadDocument(id: string, documentType: ProviderDocumentType, file: File) {
    const formData = new FormData();
    formData.append("documentType", documentType);
    formData.append("file", file);
    return httpClient.post<{
      documentType: ProviderDocumentType;
      versionNo: number;
      uploadStatus: string;
      ocrStatus: string;
      operationId?: string | null;
      executionStatus?: string | null;
    }>(`/provider-verifications/${id}/documents`, formData);
  },

  runOcr(id: string, documentType: ProviderDocumentType) {
    return httpClient.post<{
      ocrStatus: string;
      operationId?: string | null;
      executionStatus?: string | null;
      ocrConfidence?: number | null;
      extractedFields?: Record<string, unknown>;
      mismatchFlags?: string[];
    }>(`/provider-verifications/${id}/documents/${documentType}/ocr`);
  },

  submit(id: string) {
    return httpClient.post<{ status: string; submittedAt: string }>(
      `/provider-verifications/${id}/submit`,
    );
  },
};

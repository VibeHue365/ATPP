import { httpClient } from '../../../services/httpClient';
import type { PhotographyPackage, PhotographyPackagePayload } from '../types/photographyPackage.types';

const basePath = '/providers/me/photography-packages';

export const photographyPackagesApi = {
  listMine: () => httpClient.get<PhotographyPackage[]>(basePath),
  create: (payload: PhotographyPackagePayload) =>
    httpClient.post<PhotographyPackage>(basePath, payload),
  update: (id: string, payload: Partial<PhotographyPackagePayload>) =>
    httpClient.patch<PhotographyPackage>(`${basePath}/${id}`, payload),
  publish: (id: string) => httpClient.post<PhotographyPackage>(`${basePath}/${id}/publish`),
  unpublish: (id: string) => httpClient.post<PhotographyPackage>(`${basePath}/${id}/unpublish`),
};

import { getFirstMediaUrl, getMediaUrls } from '../../../shared/media/mediaUrl';
import type {
  PhotographerApiResponse,
  PhotographerDetails,
  PhotographerPortfolioBadge,
  PhotographerSummary,
} from '../types/photographer.types';

const getBadgeLabel = (badge: PhotographerPortfolioBadge): string | undefined =>
  badge.label?.trim() || badge.name?.trim();

const getConcepts = (response: PhotographerApiResponse): string[] =>
  [...new Set(
    (response.portfolioItems ?? [])
      .flatMap((item) => item.badges ?? [])
      .map(getBadgeLabel)
      .filter((label): label is string => Boolean(label)),
  )];

export const toPhotographerSummary = (response: PhotographerApiResponse): PhotographerSummary => {
  const defaultPackage = response.defaultPackage ?? response.packages?.[0];
  const concepts = getConcepts(response);

  return {
    id: response._id,
    providerId: response._id,
    name: response.businessName?.trim() || 'Nhiếp ảnh gia',
    rating: response.rating?.averageRating ?? 0,
    reviewsCount: response.rating?.totalReviews ?? 0,
    quote: response.quote?.trim() || '',
    styleTag: concepts[0] || 'Nhiếp ảnh',
    price: defaultPackage?.price ?? 0,
    location: response.address?.city?.trim() || '',
    concepts,
    image: getFirstMediaUrl(
      defaultPackage?.images?.[0],
      response.coverImage,
      response.media?.coverUrl,
      response.media?.images?.[0],
      response.portfolioItems?.[0]?.images?.[0],
    ),
    durationHours: defaultPackage?.durationHours ?? 0,
    editedPhotosCount: defaultPackage?.editedPhotosCount ?? 0,
    rawPhotosCount: defaultPackage?.rawPhotosCount ?? 0,
    packages: response.packages ?? [],
    isBookable: response.isBookable ?? Boolean(defaultPackage),
    equipment: response.equipment ?? [],
  };
};

export const toPhotographerDetails = (response: PhotographerApiResponse): PhotographerDetails => ({
  id: response._id,
  _id: response._id,
  providerId: response._id,
  businessName: response.businessName?.trim() || 'Nhiếp ảnh gia',
  quote: response.quote?.trim() || '',
  rating: {
    averageRating: response.rating?.averageRating ?? 0,
    totalReviews: response.rating?.totalReviews ?? 0,
  },
  address: response.address ?? {},
  media: {
    coverUrl: getFirstMediaUrl(response.coverImage, response.media?.coverUrl),
    images: getMediaUrls(response.media?.images),
  },
  policies: response.policies ?? {},
  equipment: response.equipment ?? [],
  portfolio: (() => {
    const legacyPortfolio = getMediaUrls(response.portfolio);
    return legacyPortfolio.length
      ? legacyPortfolio
      : (response.portfolioItems ?? []).flatMap((item) => getMediaUrls(item.images));
  })(),
  portfolioItems: (response.portfolioItems ?? []).map((item) => ({
    ...item,
    images: getMediaUrls(item.images),
  })),
  packages: response.packages ?? [],
  coverImage: getFirstMediaUrl(
    response.coverImage,
    response.media?.coverUrl,
    response.media?.images?.[0],
    response.defaultPackage?.images?.[0],
    response.portfolioItems?.[0]?.images?.[0],
  ),
});

import { useEffect, useState } from 'react';
import type { Banner, BannerPlacement } from '../types';
import { bannersApi } from '../api/banners.api';
import { DEFAULT_BANNERS } from '../constants';

export function useBanner(placement?: BannerPlacement) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(placement));

  useEffect(() => {
    if (!placement) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    bannersApi.getByPlacement(placement)
      .then((data) => {
        if (isMounted) {
          setBanner(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBanner(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [placement]);

  const defaultMeta = placement ? DEFAULT_BANNERS[placement] : null;
  const activeImageUrl = (banner?.isActive && banner.imageUrl) ? banner.imageUrl : defaultMeta?.imageUrl;

  // Preload LCP image
  useEffect(() => {
    if (!activeImageUrl) return;
    const existing = document.querySelector(`link[rel="preload"][href="${activeImageUrl}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = activeImageUrl;
    (link as any).fetchPriority = 'high';
    document.head.appendChild(link);

    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, [activeImageUrl]);

  return {
    banner,
    isLoading,
    imageUrl: activeImageUrl,
    customTitle: banner?.title || undefined,
    customSubtitle: banner?.subtitle || undefined,
  };
}

import React, { useState } from 'react';
import { getMediaUrl } from './mediaUrl';

interface ImageWithFallbackProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallback?: React.ReactNode;
}

/**
 * Renders a supplied fallback when a media URL is missing or cannot be loaded.
 * This prevents broken-image icons from being shown in public catalogue pages.
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  fallback = null,
  onError,
  ...imageProps
}) => {
  const resolvedSrc = getMediaUrl(src);
  const [failedSource, setFailedSource] = useState<string | undefined>();

  if (!resolvedSrc || failedSource === resolvedSrc) {
    return <>{fallback}</>;
  }

  return (
    <img
      {...imageProps}
      src={resolvedSrc}
      alt={alt ?? ''}
      onError={(event) => {
        setFailedSource(resolvedSrc);
        onError?.(event);
      }}
    />
  );
};

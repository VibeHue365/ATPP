import { useEffect, useState } from 'react';

export const useHeaderScroll = (threshold = 24) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > threshold);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, [threshold]);

  return isScrolled;
};
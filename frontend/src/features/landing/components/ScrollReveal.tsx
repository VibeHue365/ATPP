import React from 'react';
import { useInView, type UseInViewOptions } from '../hooks/useInView';

export interface ScrollRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
  threshold?: number;
  rootMargin?: string;
  as?: React.ElementType;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  className = '',
  delay = 0,
  stagger = false,
  threshold = 0.06,
  rootMargin = '0px 0px -40px 0px',
  as: Component = 'div',
  style,
  ...props
}) => {
  const options: UseInViewOptions = {
    threshold,
    rootMargin,
    triggerOnce: true,
  };

  const { ref, isInView } = useInView<HTMLDivElement>(options);

  return (
    <Component
      ref={ref}
      className={`lume-reveal ${isInView ? 'is-revealed' : ''} ${stagger ? 'lume-stagger' : ''} ${className}`.trim()}
      style={{
        ...style,
        ...(delay ? { transitionDelay: `${delay}ms` } : {}),
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

export default ScrollReveal;

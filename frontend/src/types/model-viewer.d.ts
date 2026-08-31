declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        'camera-controls'?: boolean;
        'touch-action'?: string;
        'auto-rotate'?: boolean;
        'shadow-intensity'?: string | number;
        exposure?: string | number;
        loading?: string;
        ar?: boolean;
        alt?: string;
        poster?: string;
        'camera-orbit'?: string;
      };
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

export {};

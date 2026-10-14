import React from 'react';
import { VirtualTryOn2DModal } from '../../virtual-tryon-2d/components/VirtualTryOn2DModal';
import type { VirtualTryOn2DModalProps } from '../../virtual-tryon-2d/components/VirtualTryOn2DModal';

export type VirtualTryOn3DModalProps = VirtualTryOn2DModalProps;

export const VirtualTryOn3DModal: React.FC<VirtualTryOn3DModalProps> = (props) => {
  return <VirtualTryOn2DModal {...props} />;
};

export default VirtualTryOn3DModal;

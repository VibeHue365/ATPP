import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string; // e.g. '500px', '800px'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '520px'
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="vh-modal-backdrop" onClick={onClose}>
      <div 
        className="vh-modal-content-wrapper" 
        style={{ maxWidth }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="vh-modal-header">
          {title ? <h3 className="vh-modal-title">{title}</h3> : <div />}
          <button className="vh-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="vh-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;

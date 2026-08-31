import React from 'react';
import { AddressBook } from '../../../users/components/AddressBook';

export const ProfileAddressesTab: React.FC = () => {
  return (
    <div className="lume-dashboard-card" style={{ gap: '20px' }}>
      <div className="lume-dashboard-card-header" style={{ marginBottom: 0 }}>
        <h3 className="lume-dashboard-card-title">Sổ địa chỉ nhận hàng</h3>
      </div>
      <AddressBook />
    </div>
  );
};

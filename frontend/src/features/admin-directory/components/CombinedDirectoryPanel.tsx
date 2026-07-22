import { useState } from 'react';
import { Users, Store, Layers } from 'lucide-react';
import { DirectoryPanel } from './DirectoryPanel';
import { CategoryManagement } from '../../../pages/admin/components/CategoryManagement';

type SubTab = 'customers' | 'providers' | 'categories';

export function CombinedDirectoryPanel({ initialSubTab = 'customers' }: { initialSubTab?: SubTab }) {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-tab Navigation Header */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          paddingBottom: '14px',
          borderBottom: '2px solid #E8E2D5',
          backgroundColor: '#FFF',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid #E8E2D5',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }}
      >
        <button
          type="button"
          onClick={() => setSubTab('customers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            backgroundColor: subTab === 'customers' ? '#4A0E17' : '#FAF6F0',
            color: subTab === 'customers' ? '#FFFFFF' : '#706E3B',
            transition: 'all 0.2s ease',
          }}
        >
          <Users size={16} color={subTab === 'customers' ? '#FFFFFF' : '#706E3B'} />
          <span>Quản lý Khách hàng</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('providers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            backgroundColor: subTab === 'providers' ? '#4A0E17' : '#FAF6F0',
            color: subTab === 'providers' ? '#FFFFFF' : '#706E3B',
            transition: 'all 0.2s ease',
          }}
        >
          <Store size={16} color={subTab === 'providers' ? '#FFFFFF' : '#706E3B'} />
          <span>Quản lý Đối tác</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('categories')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            backgroundColor: subTab === 'categories' ? '#4A0E17' : '#FAF6F0',
            color: subTab === 'categories' ? '#FFFFFF' : '#706E3B',
            transition: 'all 0.2s ease',
          }}
        >
          <Layers size={16} color={subTab === 'categories' ? '#FFFFFF' : '#706E3B'} />
          <span>Quản lý Danh mục</span>
        </button>
      </div>

      {/* Sub-tab Content Area */}
      <div>
        {subTab === 'customers' && <DirectoryPanel kind="customers" />}
        {subTab === 'providers' && <DirectoryPanel kind="providers" />}
        {subTab === 'categories' && <CategoryManagement />}
      </div>
    </div>
  );
}

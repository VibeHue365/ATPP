import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Trash2, Edit2, ArrowUp, ArrowDown,
  X, FolderPlus, Grid
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useToast } from '../../../components/feedback/Toast';
import { API_BASE_URL } from '../../../config/env';
import {
  categoryErrorMessage,
  categoryService,
} from '../../../features/categories/services/categoryService';
import type {
  Category,
  CategoryStatus,
  ServiceCategoryType,
} from '../../../features/categories/types';

export const CategoryManagement: React.FC = () => {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);

  // Tabs & filters
  const [activeTypeTab, setActiveTypeTab] = useState<ServiceCategoryType>('AODAI_CATEGORY');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [metaColor, setMetaColor] = useState('');
  const [metaOccasion, setMetaOccasion] = useState('');
  const [metaSeason, setMetaSeason] = useState('');

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      // Query admin categories, include deleted false
      const response = await categoryService.getAdmin({
        includeDeleted: false,
        limit: 100,
      });
      setCategories(response.data);
    } catch (err: unknown) {
      const message = categoryErrorMessage(
        err,
        'Không thể tải danh sách danh mục.',
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Filter categories by type tab, search keyword, and status
  const getFilteredCategories = () => {
    let list = categories.filter(c => c.type === activeTypeTab);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'ALL') {
      list = list.filter(c => c.status === statusFilter);
    }

    // Sort by displayOrder ascending
    return list.sort((a, b) => a.displayOrder - b.displayOrder);
  };

  const filteredCategories = getFilteredCategories();

  // Handle reorder display order
  const handleReorder = async (currentIndex: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredCategories.length) return;

    const currentItem = filteredCategories[currentIndex];
    const targetItem = filteredCategories[targetIndex];

    // Swap displayOrder values locally
    const currentOrder = currentItem.displayOrder;
    const targetOrder = targetItem.displayOrder;

    // Optimistic UI update
    const updatedCategories = categories.map(c => {
      if (c.id === currentItem.id) {
        return { ...c, displayOrder: targetOrder };
      }
      if (c.id === targetItem.id) {
        return { ...c, displayOrder: currentOrder };
      }
      return c;
    });

    setCategories(updatedCategories);

    setBusyCategoryId(currentItem.id);
    try {
      await categoryService.reorder(
        [
          { id: currentItem.id, displayOrder: targetOrder },
          { id: targetItem.id, displayOrder: currentOrder },
        ],
        activeTypeTab,
        'Thay đổi thứ tự hiển thị từ trang quản trị.',
      );
      toast.success('Cập nhật vị trí danh mục thành công');
      await fetchCategories();
    } catch (err: unknown) {
      toast.error(categoryErrorMessage(err, 'Lỗi khi đồng bộ thứ tự danh mục.'));
      await fetchCategories();
    } finally {
      setBusyCategoryId(null);
    }
  };

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setParentId('');
    setDescription('');
    setIconUrl('');
    setCoverImageUrl('');
    setDisplayOrder((filteredCategories.length * 10).toString());
    setMetaColor('');
    setMetaOccasion('');
    setMetaSeason('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setParentId(cat.parentId || '');
    setDescription(cat.description || '');
    setIconUrl(cat.iconUrl || '');
    setCoverImageUrl(cat.coverImageUrl || '');
    setDisplayOrder(cat.displayOrder.toString());
    setMetaColor(cat.metadata?.color || '');
    setMetaOccasion(cat.metadata?.occasion || '');
    setMetaSeason(cat.metadata?.season || '');
    setIsModalOpen(true);
  };

  // Auto slug generation
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!editingCategory) {
      // Simple slugify: lowercase, replace spaces and special chars with hyphens
      const autoSlug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove tone marks in Vietnamese
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      setSlug(autoSlug);
    }
  };

  // Form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Vui lòng nhập tên và slug');
      return;
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim() || undefined,
      iconUrl: iconUrl.trim() || undefined,
      coverImageUrl: coverImageUrl.trim() || undefined,
      displayOrder: Number(displayOrder) || 0,
      metadata: {
        color: metaColor.trim() || undefined,
        occasion: metaOccasion.trim() || undefined,
        season: metaSeason.trim() || undefined
      }
    };

    setSubmitting(true);
    try {
      if (editingCategory) {
        await categoryService.update(editingCategory.id, {
          ...payload,
          parentId: parentId || null,
        });
        toast.success('Cập nhật danh mục thành công!');
      } else {
        await categoryService.create({
          ...payload,
          type: activeTypeTab,
          parentId: parentId || undefined,
        });
        toast.success('Tạo danh mục mới thành công!');
      }
      setIsModalOpen(false);
      await fetchCategories();
    } catch (err: unknown) {
      toast.error(categoryErrorMessage(err, 'Lưu danh mục thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Soft delete category
  const handleDeleteCategory = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa danh mục?',
      text: `Bạn có chắc chắn muốn xóa "${name}" không? Không thể xóa danh mục đang có danh mục con hoặc đang được sử dụng.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      cancelButtonColor: '#7A7A7A',
      confirmButtonText: 'Xác nhận xóa',
      cancelButtonText: 'Hủy bỏ',
      background: 'white',
    });

    if (result.isConfirmed) {
      setBusyCategoryId(id);
      try {
        await categoryService.remove(id);
        toast.success(`Đã xóa danh mục "${name}"`);
        await fetchCategories();
      } catch (err: unknown) {
        toast.error(categoryErrorMessage(err, 'Xóa danh mục thất bại.'));
      } finally {
        setBusyCategoryId(null);
      }
    }
  };

  // Status toggle
  const handleToggleStatus = async (cat: Category) => {
    const newStatus: CategoryStatus = cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await Swal.fire({
      title: newStatus === 'INACTIVE' ? 'Ẩn danh mục?' : 'Kích hoạt danh mục?',
      text: newStatus === 'INACTIVE'
        ? `Danh mục "${cat.name}" sẽ không còn xuất hiện trong các form tạo mới.`
        : `Danh mục "${cat.name}" sẽ xuất hiện trở lại trong các form tạo mới.`,
      input: newStatus === 'INACTIVE' ? 'textarea' : undefined,
      inputLabel: newStatus === 'INACTIVE' ? 'Lý do ẩn danh mục *' : undefined,
      inputPlaceholder: newStatus === 'INACTIVE' ? 'Nhập lý do thay đổi trạng thái...' : undefined,
      showCancelButton: true,
      confirmButtonColor: '#4A0E17',
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy',
      preConfirm: (value) => {
        if (newStatus === 'INACTIVE' && !String(value || '').trim()) {
          Swal.showValidationMessage('Vui lòng nhập lý do ẩn danh mục');
          return false;
        }
        return value;
      },
    });

    if (!result.isConfirmed) return;

    setBusyCategoryId(cat.id);
    try {
      await categoryService.updateStatus(
        cat.id,
        newStatus,
        newStatus === 'INACTIVE'
          ? String(result.value).trim()
          : 'Kích hoạt lại danh mục từ trang quản trị',
      );
      toast.success(`Đã chuyển trạng thái danh mục sang ${newStatus === 'ACTIVE' ? 'Hoạt động' : 'Ẩn'}`);
      await fetchCategories();
    } catch (err: unknown) {
      toast.error(
        categoryErrorMessage(err, 'Lỗi khi thay đổi trạng thái danh mục.'),
      );
    } finally {
      setBusyCategoryId(null);
    }
  };

  // Helper: Get name of parent category
  const getParentName = (pId?: string | null) => {
    if (!pId) return '—';
    const parent = categories.find(c => c.id === pId);
    return parent ? parent.name : 'Không xác định';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Category Type Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E8E2D5', gap: '8px' }}>
        {[
          { key: 'AODAI_CATEGORY', label: 'Áo dài' },
          { key: 'PHOTOGRAPHY_CATEGORY', label: 'Nhiếp ảnh' },
          { key: 'CONCEPT', label: 'Concept chụp' },
          { key: 'STYLE', keyLabel: 'Phong cách', label: 'Phong cách (Style)' },
          { key: 'EVENT', label: 'Sự kiện (Event)' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTypeTab(tab.key as ServiceCategoryType)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              color: activeTypeTab === tab.key ? '#4A0E17' : '#7A7A7A',
              borderBottom: activeTypeTab === tab.key ? '3px solid #4A0E17' : '3px solid transparent',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action Toolbar: Search & Add button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        backgroundColor: 'white',
        padding: '16px 20px',
        borderRadius: '8px',
        border: '1px solid #E8E2D5'
      }}>
        <div style={{
          display: 'flex',
          flex: 1,
          maxWidth: '400px',
          alignItems: 'center',
          border: '1px solid #E8E2D5',
          borderRadius: '6px',
          padding: '0 12px',
          backgroundColor: '#FAF6F0'
        }}>
          <Search size={16} color="#7A7A7A" />
          <input
            type="text"
            placeholder="Tìm theo tên danh mục, slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'none', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #E8E2D5',
              fontSize: '13px',
              backgroundColor: 'white',
              outline: 'none',
              fontWeight: 600,
              color: '#2A2A2A'
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động (Active)</option>
            <option value="INACTIVE">Tạm ẩn (Inactive)</option>
          </select>

          <button
            onClick={handleOpenCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#4A0E17',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(74,14,23,0.15)'
            }}
          >
            <Plus size={16} /> Thêm Danh Mục
          </button>
        </div>
      </div>

      {/* Main List Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8E2D5', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#FAF6F0', borderBottom: '1px solid #E8E2D5' }}>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', width: '80px' }}>THỨ TỰ</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>HÌNH ẢNH / ICON</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TÊN DANH MỤC</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>SLUG</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>DANH MỤC CHA</th>
              <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px' }}>TRẠNG THÁI</th>
              <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700, color: '#7A7A7A', fontSize: '11px', width: '150px' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Đang tải danh sách danh mục...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#991B1B' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => void fetchCategories()}
                      style={{ padding: '7px 14px', border: '1px solid #4A0E17', borderRadius: '6px', background: 'white', color: '#4A0E17', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Thử lại
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#7A7A7A', fontStyle: 'italic' }}>Không tìm thấy danh mục nào phù hợp</td>
              </tr>
            ) : (
              filteredCategories.map((cat, index) => (
                <tr key={cat.id} style={{ borderBottom: '1px solid #FAF6F0', transition: 'background 0.15s' }}>

                  {/* Reorder controls */}
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        disabled={index === 0 || busyCategoryId !== null}
                        onClick={() => handleReorder(index, 'UP')}
                        style={{
                          padding: '4px',
                          border: '1px solid #E8E2D5',
                          borderRadius: '4px',
                          backgroundColor: index === 0 ? '#FAF6F0' : 'white',
                          color: index === 0 ? '#A0A0A0' : '#4A0E17',
                          cursor: index === 0 ? 'not-allowed' : 'pointer'
                        }}
                        title="Di chuyển lên"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        disabled={index === filteredCategories.length - 1 || busyCategoryId !== null}
                        onClick={() => handleReorder(index, 'DOWN')}
                        style={{
                          padding: '4px',
                          border: '1px solid #E8E2D5',
                          borderRadius: '4px',
                          backgroundColor: index === filteredCategories.length - 1 ? '#FAF6F0' : 'white',
                          color: index === filteredCategories.length - 1 ? '#A0A0A0' : '#4A0E17',
                          cursor: index === filteredCategories.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                        title="Di chuyển xuống"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <span style={{ fontSize: '11px', color: '#7A7A7A', marginLeft: '6px', fontWeight: 600 }}>
                        {cat.displayOrder}
                      </span>
                    </div>
                  </td>

                  {/* Icon & Cover preview */}
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {cat.iconUrl ? (
                        <img
                          src={cat.iconUrl.startsWith('http') ? cat.iconUrl : `${API_BASE_URL}${cat.iconUrl}`}
                          alt="icon"
                          style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <Grid size={18} color="#B89047" />
                      )}

                      {cat.coverImageUrl ? (
                        <img
                          src={cat.coverImageUrl.startsWith('http') ? cat.coverImageUrl : `${API_BASE_URL}${cat.coverImageUrl}`}
                          alt="cover"
                          style={{ width: '38px', height: '26px', borderRadius: '4px', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{ fontSize: '10px', color: '#A0A0A0', fontStyle: 'italic' }}>Chưa có ảnh bìa</span>
                      )}
                    </div>
                  </td>

                  {/* Name & desc */}
                  <td style={{ padding: '16px 20px' }}>
                    <div>
                      <strong style={{ color: '#4A0E17', fontSize: '14px', display: 'block' }}>{cat.name}</strong>
                      {cat.description && (
                        <span style={{ fontSize: '11px', color: '#7A7A7A', display: 'block', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat.description}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Slug */}
                  <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#7A7A7A' }}>
                    {cat.slug}
                  </td>

                  {/* Parent name */}
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#2A2A2A' }}>
                    {getParentName(cat.parentId)}
                  </td>

                  {/* Status Switch */}
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleToggleStatus(cat)}
                      disabled={busyCategoryId === cat.id}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: cat.status === 'ACTIVE' ? '#F0FDF4' : '#FEE2E2',
                        color: cat.status === 'ACTIVE' ? '#166534' : '#991B1B',
                        transition: 'all 0.15s'
                      }}
                    >
                      {cat.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ẩn'}
                    </button>
                  </td>

                  {/* Action buttons */}
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleOpenEditModal(cat)}
                        disabled={busyCategoryId === cat.id}
                        style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: '#FAF6F0', cursor: 'pointer', color: '#706E3B' }}
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        disabled={busyCategoryId === cat.id}
                        style={{ padding: '6px', border: 'none', borderRadius: '4px', backgroundColor: '#FFF5F5', cursor: 'pointer', color: '#E53E3E' }}
                        title="Xóa danh mục"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal CRUD: Create / Edit Category */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            width: '100%',
            maxWidth: '560px',
            borderRadius: '12px',
            border: '1px solid #E8E2D5',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#FAF6F0',
              borderBottom: '1px solid #E8E2D5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#4A0E17', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderPlus size={18} /> {editingCategory ? 'CHỈNH SỬA DANH MỤC' : 'THÊM DANH MỤC MỚI'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7A7A7A' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleFormSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>TÊN DANH MỤC *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Ví dụ: Áo Dài Cô Dâu"
                    required
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                {/* Slug */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>SLUG DANH MỤC *</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ao-dai-co-dau"
                    required
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Parent Category */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>DANH MỤC CHA</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none', backgroundColor: 'white' }}
                  >
                    <option value="">— Không có (Danh mục gốc) —</option>
                    {categories
                      .filter(c => c.type === activeTypeTab && c.id !== editingCategory?.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>

                {/* Display Order */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>THỨ TỰ HIỂN THỊ (DISPLAY ORDER)</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    placeholder="0"
                    min="0"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>MÔ TẢ DANH MỤC</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả ngắn gọn về danh mục dịch vụ..."
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none', resize: 'none', height: '60px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Icon URL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>ĐƯỜNG DẪN BIỂU TƯỢNG</label>
                  <input
                    type="text"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="/uploads/icons/wedding.png"
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                {/* Cover Image URL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#7A7A7A' }}>ĐƯỜNG DẪN ẢNH BÌA</label>
                  <input
                    type="text"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Metadata Fields Section */}
              <div style={{ borderTop: '1px dashed #E8E2D5', paddingTop: '14px', marginTop: '4px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#4A0E17', fontWeight: 750 }}>THÔNG TIN ĐẶC TẢ BỔ SUNG (METADATA)</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A7A' }}>MÀU SẮC (COLOR)</label>
                    <input
                      type="text"
                      value={metaColor}
                      onChange={(e) => setMetaColor(e.target.value)}
                      placeholder="Đỏ, Vàng,..."
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '12.5px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A7A' }}>DỊP LỄ (OCCASION)</label>
                    <input
                      type="text"
                      value={metaOccasion}
                      onChange={(e) => setMetaOccasion(e.target.value)}
                      placeholder="Ăn hỏi, Cưới,..."
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '12.5px', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#7A7A7A' }}>MÙA (SEASON)</label>
                    <input
                      type="text"
                      value={metaSeason}
                      onChange={(e) => setMetaSeason(e.target.value)}
                      placeholder="Mùa thu,..."
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #E8E2D5', fontSize: '12.5px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #E8E2D5', paddingTop: '16px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #E8E2D5',
                    backgroundColor: 'white',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: '#7A7A7A'
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#4A0E17',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(74,14,23,0.15)'
                  }}
                >
                  {submitting ? 'Đang lưu...' : editingCategory ? 'Cập Nhật' : 'Thêm Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

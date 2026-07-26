import React from 'react';
import { Calendar, ChevronDown, MapPin, Tag } from 'lucide-react';

interface PhotographerSearchFiltersProps {
  location: string;
  date: string;
  concept: string;
  concepts: string[];
  cameraBodies: string[];
  lenses: string[];
  selectedBodies: string[];
  selectedLenses: string[];
  priceUnder2: boolean;
  price2to5: boolean;
  priceOver5: boolean;
  minRating: string;
  onLocationChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onConceptChange: (value: string) => void;
  onToggleBody: (value: string) => void;
  onToggleLens: (value: string) => void;
  onPriceUnder2Change: (checked: boolean) => void;
  onPrice2to5Change: (checked: boolean) => void;
  onPriceOver5Change: (checked: boolean) => void;
  onMinRatingChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

const inputWrapper: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(45, 41, 38, 0.03)', border: '1px solid rgba(182, 145, 91, 0.25)', borderRadius: '8px', padding: '12px 14px' };
const inputStyle: React.CSSProperties = { border: 'none', fontSize: '14px', width: '100%', fontWeight: 600, color: '#2D2926', backgroundColor: 'transparent' };

export const PhotographerSearchFilters: React.FC<PhotographerSearchFiltersProps> = (props) => (
  <aside style={{ flex: '0 0 300px', width: '300px', backgroundColor: '#FCF9F2', borderRadius: '16px', padding: '30px 24px', height: 'fit-content', boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2)' }}>
    <h2 className="font-header" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary-dark)', marginBottom: '24px', textAlign: 'left' }}>Bộ lọc tìm kiếm</h2>
    <form onSubmit={props.onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={inputWrapper}><MapPin size={18} style={{ color: 'var(--color-gold)' }} /><input type="text" placeholder="Huế, Hội An..." value={props.location} onChange={(event) => props.onLocationChange(event.target.value)} style={inputStyle} /></div>
      <div style={inputWrapper}><Calendar size={18} style={{ color: 'var(--color-gold)' }} /><input type="date" aria-label="Ngày dự kiến" value={props.date} onChange={(event) => props.onDateChange(event.target.value)} style={inputStyle} /></div>
      <div style={{ ...inputWrapper, position: 'relative' }}><Tag size={18} style={{ color: 'var(--color-gold)' }} /><select value={props.concept} onChange={(event) => props.onConceptChange(event.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: '20px' }}><option value="Tất cả">Chọn concept</option>{props.concepts.map((concept) => <option key={concept} value={concept}>{concept}</option>)}</select><ChevronDown size={14} style={{ color: '#8C827A', position: 'absolute', right: '14px', pointerEvents: 'none' }} /></div>
      <FilterGroup title="Thân máy" items={props.cameraBodies} selected={props.selectedBodies} emptyMessage="Chưa có thông tin thân máy." onToggle={props.onToggleBody} />
      <FilterGroup title="Ống kính" items={props.lenses} selected={props.selectedLenses} emptyMessage="Chưa có thông tin ống kính." onToggle={props.onToggleLens} />
      <div style={{ marginTop: '10px', textAlign: 'left' }}>
        <FilterTitle>Mức giá</FilterTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Checkbox checked={props.priceUnder2} onChange={props.onPriceUnder2Change}>Dưới 2 triệu</Checkbox>
          <Checkbox checked={props.price2to5} onChange={props.onPrice2to5Change}>2 - 5 triệu</Checkbox>
          <Checkbox checked={props.priceOver5} onChange={props.onPriceOver5Change}>Trên 5 triệu</Checkbox>
        </div>
      </div>
      <div style={{ marginTop: '10px', textAlign: 'left' }}>
        <FilterTitle>Đánh giá</FilterTitle>
        <select value={props.minRating} onChange={(event) => props.onMinRatingChange(event.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(182, 145, 91, 0.25)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', backgroundColor: 'white', color: '#2D2926' }}><option value="">Tất cả đánh giá</option><option value="4.5">Từ 4.5 sao trở lên</option><option value="4.0">Từ 4.0 sao trở lên</option><option value="3.5">Từ 3.5 sao trở lên</option></select>
      </div>
      <button type="submit" className="vh-btn vh-btn-primary font-header" style={{ backgroundColor: 'var(--color-primary-dark)', color: '#FFFFFF', borderRadius: '8px', padding: '14px', fontSize: '14px', fontWeight: 700, border: 'none', width: '100%', marginTop: '15px', cursor: 'pointer' }}>ÁP DỤNG BỘ LỌC</button>
    </form>
  </aside>
);

const FilterTitle: React.FC<React.PropsWithChildren> = ({ children }) => <h3 className="font-header" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>{children}</h3>;

const Checkbox: React.FC<React.PropsWithChildren<{ checked: boolean; onChange: (checked: boolean) => void }>> = ({ checked, onChange, children }) => <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}><input type="checkbox" className="vh-checkbox-input" checked={checked} onChange={(event) => onChange(event.target.checked)} />{children}</label>;

const FilterGroup: React.FC<{ title: string; items: string[]; selected: string[]; emptyMessage: string; onToggle: (value: string) => void }> = ({ title, items, selected, emptyMessage, onToggle }) => <div style={{ marginTop: '10px', textAlign: 'left' }}><FilterTitle>{title}</FilterTitle><div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{items.length ? items.map((item) => <Checkbox key={item} checked={selected.includes(item)} onChange={() => onToggle(item)}>{item}</Checkbox>) : <span style={{ fontSize: '13px', color: '#8C827A' }}>{emptyMessage}</span>}</div></div>;

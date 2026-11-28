import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AIFloatingWidget } from '../src/features/dashboard/components/AIFloatingWidget';
import { httpClient } from '../src/services/httpClient';

let mockUser: { id?: string } | null = { id: 'user-a' };

vi.mock('../src/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../src/components/feedback/Toast', () => ({
  useToast: () => ({
    info: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../src/services/httpClient', () => ({
  httpClient: {
    post: vi.fn(),
  },
}));

describe('TàGo Stylist AI persistence & widget lifecycle', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    mockUser = { id: 'user-a' };
  });

  it('preserves conversation and draft input when closing and reopening widget, and across reload', async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({
      answer: 'Áo dài cổ thuyền giúp tôn dáng cổ thanh thoát hơn ạ!',
      category: 'style',
      source: 'gemini_learned',
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <AIFloatingWidget />
      </MemoryRouter>,
    );

    // Open widget
    fireEvent.click(screen.getByRole('button', { name: 'Mở TàGo Stylist AI' }));

    const input = screen.getByPlaceholderText('Hỏi về kiểu dáng hoặc gửi ảnh mẫu...');
    fireEvent.change(input, { target: { value: 'Tư vấn cổ áo dài giúp mình' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Áo dài cổ thuyền giúp tôn dáng cổ thanh thoát hơn ạ!')).toBeDefined();
    });

    // Type a draft message, then close and reopen
    fireEvent.change(input, { target: { value: 'Còn màu đỏ đô thì sao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đóng cửa sổ tư vấn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mở TàGo Stylist AI' }));

    expect(screen.getByText('Tư vấn cổ áo dài giúp mình')).toBeDefined();
    expect(screen.getByText('Áo dài cổ thuyền giúp tôn dáng cổ thanh thoát hơn ạ!')).toBeDefined();
    expect(
      (screen.getByPlaceholderText('Hỏi về kiểu dáng hoặc gửi ảnh mẫu...') as HTMLInputElement).value,
    ).toBe('Còn màu đỏ đô thì sao');

    // Simulate full page reload (unmount + remount)
    unmount();
    render(
      <MemoryRouter initialEntries={['/rentals']}>
        <AIFloatingWidget />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở TàGo Stylist AI' }));
    expect(screen.getByText('Tư vấn cổ áo dài giúp mình')).toBeDefined();
    expect(screen.getByText('Áo dài cổ thuyền giúp tôn dáng cổ thanh thoát hơn ạ!')).toBeDefined();

    // Reset conversation clears history
    fireEvent.click(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }));
    expect(screen.queryByText('Tư vấn cổ áo dài giúp mình')).toBeNull();
    expect(screen.queryByText('Áo dài cổ thuyền giúp tôn dáng cổ thanh thoát hơn ạ!')).toBeNull();
  });

  it('isolates chat history between different user accounts', async () => {
    localStorage.setItem(
      'tago_stylist_chat_v1_user-a',
      JSON.stringify([
        { sender: 'ai', text: 'Chào User A' },
        { sender: 'user', text: 'Tin nhắn riêng của User A' },
      ]),
    );

    mockUser = { id: 'user-b' };
    render(
      <MemoryRouter initialEntries={['/']}>
        <AIFloatingWidget />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở TàGo Stylist AI' }));
    expect(screen.queryByText('Tin nhắn riêng của User A')).toBeNull();
  });
});

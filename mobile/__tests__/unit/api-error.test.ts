import axios from 'axios';
import { getApiErrorMessage } from '@/utils/apiError';

describe('getApiErrorMessage', () => {
  it('returns a normal Error message', () => {
    expect(getApiErrorMessage(new Error('Test error'))).toBe('Test error');
  });

  it('returns the fallback for an unknown value', () => {
    expect(getApiErrorMessage(null, 'Fallback message')).toBe('Fallback message');
  });

  it('uses the first validation message returned by the API', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    const error = { response: { data: { message: ['Email không hợp lệ', 'Mật khẩu không hợp lệ'] } } };
    expect(getApiErrorMessage(error)).toBe('Email không hợp lệ');
  });

  it('supports nested API errors', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    const error = { response: { data: { error: { message: 'Không thể thanh toán' } } } };
    expect(getApiErrorMessage(error)).toBe('Không thể thanh toán');
  });

  it('returns the timeout message for an aborted request', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    expect(getApiErrorMessage({ code: 'ECONNABORTED' })).toBe('Kết nối quá thời gian. Vui lòng thử lại.');
  });
});

import axios from 'axios';
export function getApiErrorMessage(error:unknown,fallback='Đã có lỗi xảy ra. Vui lòng thử lại.'){
  if(axios.isAxiosError(error)){const data=error.response?.data as {message?:string|string[];error?:{message?:string}}|undefined;const message=Array.isArray(data?.message)?data.message[0]:data?.message;return message??data?.error?.message??(error.code==='ECONNABORTED'?'Kết nối quá thời gian. Vui lòng thử lại.':fallback)}
  return error instanceof Error?error.message:fallback;
}

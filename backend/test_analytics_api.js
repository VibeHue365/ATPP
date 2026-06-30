const http = require('http');

async function request(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: '127.0.0.1', port: 3000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d.slice(0, 500) }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('Logging in as provider.demo@vibehue.com...');
  const loginRes = await request('POST', '/auth/login', {
    email: 'provider.demo@vibehue.com',
    password: 'Test@123456'
  });
  
  const token = loginRes.body?.accessToken;
  if (!token) {
    console.error('Login failed:', loginRes);
    return;
  }
  
  console.log('Obtained token. Calling /providers/me/analytics...');
  const res = await request('GET', '/providers/me/analytics', null, token);
  console.log('Status:', res.status);
  console.log('Analytics Response:', JSON.stringify(res.body, null, 2));
}

main().catch(console.error);

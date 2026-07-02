const http = require('http');

async function request(method, path, body, token) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'localhost', port: 3000, path, method,
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
        catch { resolve({ status: res.statusCode, body: d.slice(0, 300) }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // Step 1: Login as admin
  console.log('1. Logging in as admin...');
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@vibehue.com',
    password: 'Admin@vibehue2026'
  });
  
  const token = loginRes.body?.accessToken;
  if (!token) {
    console.log('Login failed:', loginRes);
    return;
  }
  console.log('Admin token obtained. Roles:', loginRes.body?.user?.roles);

  // Step 2: Get customers list to find a real ID
  console.log('\n2. Getting customers list...');
  const custRes = await request('GET', '/admin/stats/customers?page=1&limit=5', null, token);
  console.log('Customers status:', custRes.status);
  const customers = custRes.body?.items || [];
  console.log('Customer count:', customers.length);
  if (customers.length > 0) {
    console.log('First customer:', customers[0].id, customers[0].fullName, customers[0].status);
  }

  // Step 3: Test ban endpoint
  if (customers.length > 0) {
    const testId = customers[0].id;
    console.log(`\n3. Testing BAN endpoint on customer ${testId}...`);
    const banRes = await request('PATCH', `/admin/stats/customers/${testId}/ban`, {}, token);
    console.log('Ban status:', banRes.status, banRes.body);

    // Step 4: Test unban
    console.log(`\n4. Testing UNBAN endpoint on customer ${testId}...`);
    const unbanRes = await request('PATCH', `/admin/stats/customers/${testId}/unban`, {}, token);
    console.log('Unban status:', unbanRes.status, unbanRes.body);
  }

  // Step 5: Test provider suspend
  console.log('\n5. Getting providers list...');
  const provRes = await request('GET', '/admin/stats/providers?page=1&limit=5', null, token);
  console.log('Providers status:', provRes.status);
  const providers = provRes.body?.items || [];
  if (providers.length > 0) {
    const prov = providers[0];
    console.log('First provider:', prov.id, prov.businessName, prov.status);

    console.log(`\n6. Testing SUSPEND provider ${prov.id}...`);
    const suspRes = await request('PATCH', `/admin/providers/${prov.id}/suspend`, { reason: 'Test suspend', note: 'Test' }, token);
    console.log('Suspend status:', suspRes.status, suspRes.body);

    console.log(`\n7. Testing UNSUSPEND provider ${prov.id}...`);
    const unsuspRes = await request('PATCH', `/admin/providers/${prov.id}/unsuspend`, { reason: 'Test unsuspend', note: 'Test' }, token);
    console.log('Unsuspend status:', unsuspRes.status, unsuspRes.body);
  }
}

main().catch(console.error);

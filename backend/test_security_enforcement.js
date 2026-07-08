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
        catch { resolve({ status: res.statusCode, body: d.slice(0, 300) }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('==================================================');
  console.log('TESTING SECURITY ENFORCEMENT: BAN & SUSPENSION');
  console.log('==================================================');

  // Step 1: Login as admin
  console.log('\n1. Logging in as Admin...');
  const adminLogin = await request('POST', '/auth/login', {
    email: 'admin@vibehue.com',
    password: 'Admin@vibehue2026'
  });
  const adminToken = adminLogin.body?.accessToken;
  if (!adminToken) {
    console.error('Failed to log in as admin:', adminLogin);
    return;
  }
  console.log('Admin login successful.');

  // Find target customer & provider from database lists
  console.log('\n2. Fetching customer and provider to test...');
  const custs = await request('GET', '/admin/stats/customers?page=1&limit=100', null, adminToken);
  const provs = await request('GET', '/admin/stats/providers?page=1&limit=100', null, adminToken);

  const targetCustomer = custs.body?.items?.find(c => c.email === 'customer@vibehue.com');
  const targetProvider = provs.body?.items?.find(p => p.email === 'provider.demo@vibehue.com');

  if (!targetCustomer || !targetProvider) {
    console.error('Test accounts customer@vibehue.com or provider.demo@vibehue.com not found in stats lists!');
    return;
  }
  console.log(`Target Customer ID: ${targetCustomer.id} (${targetCustomer.fullName})`);
  console.log(`Target Provider ID: ${targetProvider.id} (${targetProvider.businessName})`);

  // Ensure both are currently ACTIVE before we start
  console.log('\n3. Resetting accounts to ACTIVE for clean start...');
  await request('PATCH', `/admin/stats/customers/${targetCustomer.id}/unban`, {}, adminToken);
  await request('PATCH', `/admin/providers/${targetProvider.id}/unsuspend`, { reason: 'Reset' }, adminToken);

  // Login as Customer and Provider to get valid tokens
  console.log('\n4. Logging in as Customer & Provider...');
  const custLogin = await request('POST', '/auth/login', { email: 'customer@vibehue.com', password: 'Test@123456' });
  const provLogin = await request('POST', '/auth/login', { email: 'provider.demo@vibehue.com', password: 'Test@123456' });

  const custToken = custLogin.body?.accessToken;
  const provToken = provLogin.body?.accessToken;

  if (!custToken || !provToken) {
    console.error('Failed to obtain customer/provider tokens:', { custLogin, provLogin });
    return;
  }
  console.log('Customer and Provider tokens obtained successfully.');

  // Verify normal operations work
  console.log('\n5. Verifying active session operations...');
  const custMeBefore = await request('GET', '/users/me', null, custToken);
  const provMeBefore = await request('GET', '/providers/me', null, provToken);
  console.log('Customer /users/me status:', custMeBefore.status);
  console.log('Provider /providers/me status:', provMeBefore.status);

  // ----------------------------------------------------
  // TEST CUSTOMER BAN
  // ----------------------------------------------------
  console.log('\n6. Banning customer via Admin API...');
  const banRes = await request('PATCH', `/admin/stats/customers/${targetCustomer.id}/ban`, {}, adminToken);
  console.log('Ban response:', banRes.status, banRes.body);

  console.log('\n7. Verifying banned customer gets rejected instantly (using existing token)...');
  const custMeAfter = await request('GET', '/users/me', null, custToken);
  console.log('Banned Customer /users/me status:', custMeAfter.status, custMeAfter.body);

  console.log('\n8. Verifying banned customer cannot log in again...');
  const custLoginAgain = await request('POST', '/auth/login', { email: 'customer@vibehue.com', password: 'Test@123456' });
  console.log('Banned Customer login status:', custLoginAgain.status, custLoginAgain.body);

  // ----------------------------------------------------
  // TEST PROVIDER SUSPENSION
  // ----------------------------------------------------
  console.log('\n9. Suspending provider via Admin API...');
  const suspRes = await request('PATCH', `/admin/providers/${targetProvider.id}/suspend`, { reason: 'Test' }, adminToken);
  console.log('Suspend response:', suspRes.status, suspRes.body);

  console.log('\n10. Verifying suspended provider gets rejected on provider APIs (using existing token)...');
  const provMeAfter = await request('GET', '/providers/me', null, provToken);
  console.log('Suspended Provider /providers/me status:', provMeAfter.status, provMeAfter.body);

  const provBookings = await request('GET', '/bookings/provider', null, provToken);
  console.log('Suspended Provider /bookings/provider status:', provBookings.status, provBookings.body);

  // Restore everything to clean up
  console.log('\n11. Cleaning up: restoring accounts to active...');
  await request('PATCH', `/admin/stats/customers/${targetCustomer.id}/unban`, {}, adminToken);
  await request('PATCH', `/admin/providers/${targetProvider.id}/unsuspend`, { reason: 'Cleanup' }, adminToken);
  console.log('Cleanup finished.');
}

main().catch(console.error);

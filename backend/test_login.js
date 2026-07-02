const http = require('http');

function testLogin(email, password) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ email, password });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          console.log(`Login ${email} => status: ${res.statusCode}, roles: ${j.user?.roles}, message: ${j.message || 'OK'}`);
        } catch(e) {
          console.log(`Login ${email} => status: ${res.statusCode}, body: ${d.slice(0, 200)}`);
        }
        resolve();
      });
    });
    req.on('error', e => { console.error('Error:', e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

async function main() {
  await testLogin('admin@vibehue.com', 'Admin@123456');
  await testLogin('admin@vibehue.com', 'admin123456');
  await testLogin('admin@vibehue.com', 'Admin123456');
  await testLogin('admin@vibehue.com', '123456');
}

main();

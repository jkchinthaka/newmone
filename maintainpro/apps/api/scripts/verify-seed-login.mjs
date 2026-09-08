import http from 'node:http';

const password = process.env.MAINTAINPRO_SEED_PASSWORD ?? '';
if (!password) {
  console.error('MAINTAINPRO_SEED_PASSWORD missing');
  process.exit(1);
}

const body = JSON.stringify({
  email: 'superadmin@maintainpro.local',
  password,
});

const req = http.request(
  {
    hostname: process.argv[2] ?? '127.0.0.1',
    port: Number(process.argv[3] ?? 3000),
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      const ok = res.statusCode === 200 || res.statusCode === 201;
      console.log(JSON.stringify({ status: res.statusCode, ok, hasToken: data.includes('accessToken') }));
      process.exit(ok ? 0 : 1);
    });
  },
);

req.on('error', (err) => {
  console.error(err.message);
  process.exit(1);
});

req.write(body);
req.end();

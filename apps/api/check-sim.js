const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ json: () => JSON.parse(data) }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  // Login
  const loginRes = await fetch('http://localhost:8007/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'legendabrahamonoja@gmail.com', password: 'Xxxploit_18' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;

  // Get simulation
  const simRes = await fetch('http://localhost:8007/v1/future-self/simulation', {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  const simData = await simRes.json();
  const d = simData.data;

  console.log('\nHorizon    | Current Path | With IKPA    | Difference   | Gap %');
  console.log('-'.repeat(70));
  const horizons = ['6mo', '1yr', '5yr', '10yr', '20yr'];
  for (const h of horizons) {
    const c = d.currentBehavior.projectedNetWorth[h];
    const o = d.withIKPA.projectedNetWorth[h];
    const diff = o - c;
    const pct = c > 0 ? (diff / c * 100) : 0;
    console.log(`${h.padEnd(10)} | $${c.toLocaleString().padStart(11)} | $${o.toLocaleString().padStart(11)} | $${diff.toLocaleString().padStart(11)} | ${pct.toFixed(1)}%`);
  }

  console.log(`\nCurrent savings rate: ${(d.currentBehavior.savingsRate * 100).toFixed(1)}%`);
  console.log(`IKPA savings rate:    ${(d.withIKPA.savingsRate * 100).toFixed(1)}%`);
  console.log(`20yr difference:      $${d.difference_20yr.toLocaleString()}`);
}

main().catch(console.error);

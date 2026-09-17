// Печатает DTO окон/очереди из admin overview (для сверки с БД).
const BASE = 'http://localhost:8080/api/v1';
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ email: 'admin@pochta.local', password: 'admin1234' }),
});
const cookie = String(login.headers.getSetCookie().find((c) => c.startsWith('session='))).split(';')[0];
const ov = await (await fetch(`${BASE}/admin/branches/11111111-1111-1111-1111-111111111111/overview`, {
  headers: { Cookie: cookie, Origin: 'http://localhost:5173' },
})).json();

console.log('WINDOWS:');
for (const w of ov.windows ?? []) {
  console.log(` number=${w.number} id=${w.id} status=${w.status} current=${w.currentTicketNumber ?? '-'} service=${w.currentService ?? '-'} served=${w.servedCount} operator=${w.operatorName ?? '-'} services=[${(w.services ?? []).map((s) => `${s.id}:${s.name}`).join(', ')}]`);
}
console.log('QUEUE:', (ov.queue ?? []).map((t) => `${t.publicNumber}/${t.status}/${t.serviceName}`).join(', '));
console.log('METRICS:', JSON.stringify(ov.metrics));
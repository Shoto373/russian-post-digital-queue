// Воспроизводит «свою жизнь» окон: локальные действия оператора откатываются поллингом.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const login = await fetch('http://localhost:8080/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ email: 'admin@pochta.local', password: 'admin1234' }),
});
const session = String(login.headers.getSetCookie().find((c) => c.startsWith('session='))).split(';')[0].slice(8);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pocta-repro-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9225', `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let targets = null;
for (let i = 0; i < 60 && !targets; i++) {
  try { targets = await (await fetch('http://127.0.0.1:9225/json/list')).json(); } catch { await wait(500); }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.text);
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args?.map((a) => a.value)));
});
const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
await send('Network.setCookie', { name: 'session', value: session, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' });
await send('Page.navigate', { url: 'http://localhost:5173/demo/operator' });
await wait(9000);

const snapshot = () => evalJs(`(() => {
  const t = document.body.innerText;
  const badge = [...document.querySelectorAll('span')].find((s) => /СМЕНА АКТИВНА|ОКНО ЗАКРЫТО/.test(s.textContent));
  const chips = [...document.querySelectorAll('button')].filter((b) => /^№ \\d/.test(b.textContent.trim())).map((b) => b.textContent.trim());
  const header = [...document.querySelectorAll('h2')].map((h) => h.textContent.trim())[0] || null;
  const ls = JSON.parse(localStorage.getItem('pochta_suo_3_state_v2') || '{}');
  return { header, badge: badge ? badge.textContent.trim() : null, chips, lsWindows: (ls.windows || []).map((w) => w.id + ':' + w.status + ':' + (w.services || []).length) };
})()`);

const lsKeys = await evalJs(`Object.keys(localStorage)`);
console.log('localStorage keys:', lsKeys);
console.log('t0 (после загрузки):', JSON.stringify(await snapshot()));

// 1) Клик по «Закрыть смену»
await evalJs(`[...document.querySelectorAll('button')].find((b) => /Закрыть смену|Открыть смену/.test(b.textContent)).click()`);
await wait(400);
console.log('после клика (t+0.4s):', JSON.stringify(await snapshot()));
await wait(4500);
console.log('через 4.9s:', JSON.stringify(await snapshot()));

// 2) Переключение услуги окна
await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Услуги окна$/.test('Услуги окна') && false); })()`);
const svcBefore = await evalJs(`(() => [...document.querySelectorAll('button')].filter((b) => /Отправка писем|Посылки|Платежи|Почтовые товары/.test(b.textContent) && b.className.includes('rounded-lg')).map((b) => b.textContent.trim() + (b.className.includes('line-through') ? ':off' : ':on')))()`);
await evalJs(`(() => { const b = [...document.querySelectorAll('button')].filter((x) => /Отправка писем/.test(x.textContent) && x.className.includes('rounded-lg'))[0]; if (b) b.click(); return Boolean(b); })()`);
await wait(500);
const svcAfter = await evalJs(`(() => [...document.querySelectorAll('button')].filter((b) => /Отправка писем|Посылки|Платежи|Почтовые товары/.test(b.textContent) && b.className.includes('rounded-lg')).map((b) => b.textContent.trim() + (b.className.includes('line-through') ? ':off' : ':on')))()`);
await wait(4500);
const svcLater = await evalJs(`(() => [...document.querySelectorAll('button')].filter((b) => /Отправка писем|Посылки|Платежи|Почтовые товары/.test(b.textContent) && b.className.includes('rounded-lg')).map((b) => b.textContent.trim() + (b.className.includes('line-through') ? ':off' : ':on')))()`);
console.log('услуги до:', svcBefore.join(' '), '| сразу:', svcAfter.join(' '), '| через 5s:', svcLater.join(' '));

console.log('errors:', errors.length ? errors.join(' | ') : '(none)');
chrome.kill('SIGKILL');
import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
for (const route of ['/', '/owner', '/owner/demand/chat', '/owner/demand/demo-demand', '/owner/matches/demo-demand', '/owner/quotes/demo-demand', '/owner/project/demo-demand', '/owner/payments/demo-demand', '/provider', '/provider/demand/demo-demand', '/provider/orders', '/admin', '/admin/tickets']) {
 const response = await fetch(base + route);
 assert.equal(response.status, 200, route);
 assert.match(await response.text(), /模拟|待开发/);
}
for (const route of ['/api/health', '/api/demand', '/api/provider', '/api/match', '/api/quote', '/api/schedule', '/api/payment', '/api/ticket']) {
 const response = await fetch(base + route);
 assert.equal(response.status, 200, route);
 const payload = await response.json();
 assert.equal(payload.ok, true);
 if (route === '/api/demand') assert.ok(['mock', 'live'].includes(payload.meta.source));
 else assert.equal(payload.meta.source, 'mock');
}
const demoDetail = await fetch(base + '/api/demand/demo-demand');
assert.equal(demoDetail.status, 200);
assert.equal((await demoDetail.json()).meta.source, 'mock');
const missingDetail = await fetch(base + '/api/demand/missing-demand');
assert.equal(missingDetail.status, 404);
const chat = await fetch(base + '/api/demand/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({messages:[{role:'user',content:'我想翻新浴室'}]}) });
assert.equal(chat.status, 200);
assert.equal((await chat.json()).data.ready, false);
const bad = await fetch(base + '/api/demand/chat', { method:'POST', body:'invalid json' });
assert.equal(bad.status, 400);
const demandBody = JSON.stringify({
 description: '冒烟测试需求', city: '深圳', areaM2: 60,
 budgetMinCents: 3000000, budgetMaxCents: 5000000,
 renovationType: 'elderly', desiredDays: 30,
});
// Creating a demand requires an actual owner session. Do not write anonymous fixtures.
const unauthenticated = await fetch(base + '/api/demand', {
 method: 'POST',
 headers: {'Content-Type':'application/json', Origin: new URL(base).origin},
 body: demandBody,
});
assert.equal(unauthenticated.status, 401, 'anonymous demand creation');
assert.equal(unauthenticated.headers.get('cache-control'), 'private, no-store');
assert.ok((unauthenticated.headers.get('vary') ?? '').split(',').some(value => value.trim().toLowerCase() === 'cookie'));
const denied = await unauthenticated.json();
assert.equal(denied.ok, false);
assert.equal(denied.error.code, 'UNAUTHENTICATED');
assert.equal('data' in denied, false);
const withoutOrigin = await fetch(base + '/api/demand', {
 method: 'POST', headers: {'Content-Type':'application/json'}, body: demandBody,
});
assert.equal(withoutOrigin.status, 403, 'demand creation without Origin');
const forbidden = await withoutOrigin.json();
assert.equal(forbidden.ok, false);
assert.equal(forbidden.error.code, 'FORBIDDEN');
assert.equal('data' in forbidden, false);
console.log('13 个页面、10 个 GET 场景和 4 个 POST 场景通过（匿名创建已拒绝，未写入需求）。');

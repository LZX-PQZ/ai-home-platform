import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
let demoSchedule;
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
 if (route === '/api/demand') {
  assert.ok(['mock', 'live'].includes(payload.meta.source));
  assert.ok(payload.data.every(demand => demand.status === 'published' && !('ownerId' in demand)));
  assert.ok(payload.data.some(demand => demand.id === 'demo-demand'));
 }
 else assert.equal(payload.meta.source, 'mock');
 if (route === '/api/schedule') demoSchedule = payload.data;
}
const demoDetail = await fetch(base + '/api/demand/demo-demand');
assert.equal(demoDetail.status, 200);
const demoPayload = await demoDetail.json();
assert.equal(demoPayload.meta.source, 'mock');
assert.equal(demoPayload.data.status, 'published');
assert.equal('ownerId' in demoPayload.data, false);
for (const route of ['/api/demand', '/api/demand/demo-demand']) {
 const invalidOwner = await fetch(base + route, { headers: { Cookie: '__Host-ai_home_owner_session=invalid' } });
 assert.equal(invalidOwner.status, 401, `${route} must not downgrade an invalid owner cookie to public access`);
 assert.equal(invalidOwner.headers.get('cache-control'), 'private, no-store');
 assert.ok((invalidOwner.headers.get('vary') ?? '').split(',').some(value => value.trim().toLowerCase() === 'cookie'));
 const failure = await invalidOwner.json();
 assert.equal(failure.ok, false); assert.equal(failure.error.code, 'UNAUTHENTICATED');
 assert.equal('data' in failure, false);
}
const missingDetail = await fetch(base + '/api/demand/missing-demand');
assert.equal(missingDetail.status, 404);
for (const path of ['/api/schedule?demandId=demo-demand', '/api/schedule?demandId=demo-demand&version=1']) {
 const response = await fetch(base + path);
 assert.equal(response.status, 200, path);
 assert.equal(response.headers.get('cache-control'), 'private, no-store');
 assert.ok((response.headers.get('vary') ?? '').split(',').some(value => value.trim().toLowerCase() === 'cookie'));
 const body = await response.json();
 assert.equal(body.ok, true); assert.equal(body.meta.source, 'mock');
 assert.equal(body.data.demandId, 'demo-demand'); assert.equal(body.data.version, 1);
 assert.deepEqual(body.data, demoSchedule);
}
for (const [path, status, code] of [
 ['/api/schedule?demandId=smoke-private-demand', 401, 'UNAUTHENTICATED'],
 ['/api/schedule?demandId=demo-demand&version=2', 404, 'SCHEDULE_NOT_FOUND'],
 ['/api/schedule?unknown=', 400, 'VALIDATION_ERROR'],
]) {
 const response = await fetch(base + path);
 assert.equal(response.status, status, path);
 assert.equal(response.headers.get('cache-control'), 'private, no-store');
 assert.ok((response.headers.get('vary') ?? '').split(',').some(value => value.trim().toLowerCase() === 'cookie'));
 const body = await response.json();
 assert.equal(body.ok, false); assert.equal(body.error.code, code); assert.equal('data' in body, false);
}
for (const path of ['/api/schedule', '/api/schedule?demandId=demo-demand', '/api/schedule?demandId=demo-demand&version=1']) {
 const response = await fetch(base + path, { headers: { Cookie: '__Host-ai_home_owner_session=invalid' } });
 assert.equal(response.status, 401, `${path} must reject an invalid owner cookie`);
 assert.equal(response.headers.get('cache-control'), 'private, no-store');
 assert.ok((response.headers.get('vary') ?? '').split(',').some(value => value.trim().toLowerCase() === 'cookie'));
 const body = await response.json();
 assert.equal(body.ok, false); assert.equal(body.error.code, 'UNAUTHENTICATED'); assert.equal('data' in body, false);
}
// Schedule creation is implemented and owner-only; anonymous smoke must never write fixtures.
for (const [headers, status, code] of [
 [{}, 403, 'FORBIDDEN'],
 [{ Origin: new URL(base).origin }, 401, 'UNAUTHENTICATED'],
 [{ Origin: new URL(base).origin, Cookie: '__Host-ai_home_owner_session=invalid' }, 401, 'UNAUTHENTICATED'],
]) {
 const response = await fetch(base + '/api/schedule', { method: 'POST', headers });
 assert.equal(response.status, status, 'schedule creation authorization');
 assert.equal(response.headers.get('cache-control'), 'private, no-store');
 assert.ok((response.headers.get('vary') ?? '').split(',').some(value => value.trim().toLowerCase() === 'cookie'));
 const body = await response.json();
 assert.equal(body.ok, false); assert.equal(body.error.code, code); assert.equal('data' in body, false);
}
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
console.log('13 个页面、20 个 GET 场景和 7 个 POST 场景通过（固定演示排期公开、真实排期隔离、匿名与失效凭证写入拒绝）。');

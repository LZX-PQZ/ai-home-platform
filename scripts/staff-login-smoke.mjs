import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { require as tsRequire } from 'tsx/cjs/api';
const { hashOwnerPassword } = tsRequire('../src/lib/owner-password.ts', import.meta.url);

export async function runStaffLoginSmoke(base) {
 const db = new PrismaClient();
 const suffix = randomBytes(8).toString('hex');
 const password = randomBytes(18).toString('base64url');
 const ids = { provider: `smoke-staff-provider-${suffix}`, admin: `smoke-staff-admin-${suffix}`, owner: `smoke-staff-owner-${suffix}` };
 const providerId = `smoke-directory-${suffix}`;
 const origin = new URL(base).origin;
 const failureKeys = new Set();
 const call = (role, method='GET', cookie='', input) => {
  if(method==='POST' && input) failureKeys.add(`staff:${role}:${createHash('sha256').update(input.login).digest('hex')}`);
  return fetch(`${base}/api/auth/${role}`, {
  method, headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'}, ...(input ? {body:JSON.stringify(input)} : {}),
 }); };
 try {
  const passwordHash = await hashOwnerPassword(password);
  await db.serviceProvider.create({data:{id:providerId,name:'Synthetic login smoke',city:'深圳',kind:'construction',tagsJson:'[]'}});
  for (const role of ['owner','provider','admin']) {
   await db.user.create({data:{id:ids[role],name:'Synthetic login smoke',role,providerId:role==='provider'?providerId:null}});
   await db[role==='owner'?'ownerCredential':'staffCredential'].create({data:{userId:ids[role],login:ids[role],passwordHash}});
  }
  for (const [role, path] of [['provider','/provider/orders'],['admin','/admin/tickets']]) {
   const anonymous = await fetch(base+path,{redirect:'manual'});
   assert.equal(anonymous.status,307); assert.match(anonymous.headers.get('location'),new RegExp(`/login/${role}`));
   assert.equal(new URL(anonymous.headers.get('location'), origin).origin, origin, '登录跳转必须保留浏览器原主机和端口');
   const wrongRole = await call(role,'POST','',{login:ids.owner,password}); assert.equal(wrongRole.status,401);
   const wrongPassword = await call(role,'POST','',{login:ids[role],password:'Wrong password 0000'}); assert.equal(wrongPassword.status,401);
   const signed = await call(role,'POST','',{login:ids[role],password}); assert.equal(signed.status,200);
   const body=await signed.json(); assert.equal(body.data.identity.role,role); assert.equal(body.meta.source,'live');
   const cookie=signed.headers.getSetCookie()[0].split(';')[0];
   assert.match(signed.headers.getSetCookie()[0],/HttpOnly; Secure; SameSite=Strict/);
   const page=await fetch(base+path,{headers:{Cookie:cookie},redirect:'manual'}); assert.equal(page.status,200);
   const html=await page.text(); assert.match(html,role==='provider'?/服务方账号登录/:/平台运营账号登录/);
   assert.doesNotMatch(html,/aria-label="业主账号登录"|aria-label="演示服务方登录"/);
   const other=await fetch(base+(role==='provider'?'/admin':'/provider'),{headers:{Cookie:cookie},redirect:'manual'}); assert.equal(other.status,307);
   if(role==='provider') {
    const quotes=await fetch(base+'/api/provider/quotes',{headers:{Cookie:cookie}}); assert.equal(quotes.status,200); assert.deepEqual((await quotes.json()).data,[]);
    const orders=await fetch(base+'/api/provider/orders',{headers:{Cookie:cookie}}); assert.equal(orders.status,200); assert.deepEqual((await orders.json()).data,[]);
   }
   assert.equal((await call(role,'DELETE',cookie)).status,200);
   assert.equal((await fetch(base+path,{headers:{Cookie:cookie},redirect:'manual'})).status,307);
   assert.equal((await (await call(role,'GET',cookie)).json()).data.status,'signed_out');
  }
  const ownerPage=await fetch(base+'/owner'); const ownerHtml=await ownerPage.text();
  assert.match(ownerHtml,/aria-label="业主账号登录"/); assert.doesNotMatch(ownerHtml,/aria-label="演示服务方登录"|aria-label="服务方账号登录"|aria-label="平台运营账号登录"/);
  console.log('三端登录生产 HTTP 通过：密码/角色校验、对应登录栏、服务方实际私有接口、页面门禁与退出后拒绝。');
 } finally {
  await db.ownerLoginAttempt.deleteMany({where:{key:{in:[...failureKeys]}}});
  await db.user.deleteMany({where:{id:{in:Object.values(ids)}}});
  await db.serviceProvider.deleteMany({where:{id:providerId}});
  await db.$disconnect();
 }
}

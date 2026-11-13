import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Schedule } from "../src/contracts";
import { ScheduleContent } from "../src/features/a/SchedulePanel";
import type { ScheduleState } from "../src/features/a/useSchedule";

// tsx 对 jsx:preserve 使用经典 JSX，仅在渲染测试期间提供 React。
const previousReact = Object.getOwnPropertyDescriptor(globalThis, "React");
before(() => Object.defineProperty(globalThis, "React", { configurable: true, value: React }));
after(() => {
  if (previousReact) Object.defineProperty(globalThis, "React", previousReact);
  else Reflect.deleteProperty(globalThis, "React");
});

const schedule = Schedule.parse({
  demandId: "test-demand", version: 1,
  tasks: [{ id: "test-task", name: "测试工序", startDay: 2, durationDays: 3, dependsOn: [], responsibleProviderId: null, status: "done" }],
});
const ready = (source: "mock" | "live" = "mock"): ScheduleState => ({ phase: "ready", data: schedule, source, error: null });
const render = (state: ScheduleState, id = schedule.demandId) => renderToStaticMarkup(
  createElement(ScheduleContent, { id, state, reload() {} }),
);

test("排期 ID 不匹配时不展示他人图表、统计、工序或操作", () => {
  const html = render(ready(), "other/a?#");
  assert.match(html, /这条排期不属于当前需求/);
  assert.match(html, /不能证明当前需求没有排期/);
  assert.doesNotMatch(html, /工序时间轴|计划总工期|测试工序|申请排期变更|确认阶段验收|progressbar/);
  assert.ok(html.includes(`/owner/demand/${encodeURIComponent("other/a?#")}`));
  assert.match(html, /重新加载/);
});

test("错位空排期也必须报不匹配，不能断言当前需求没有排期", () => {
  const html = render({ ...ready(), data: { ...schedule, tasks: [] } }, "other");
  assert.match(html, /这条排期不属于当前需求/);
  assert.doesNotMatch(html, /这条需求还没有排期|接口没有返回任何工序/);
});

test("全部完成显示 100% 和完成状态，但不声称验收通过", () => {
  const html = render(ready());
  assert.match(html, /工序全部完成/);
  assert.match(html, /aria-valuenow="100"/);
  assert.match(html, /不代表验收通过/);
  assert.doesNotMatch(html, />未开工</);
  assert.match(html, /责任方：.*待指派/);
});

test("mock/live 分别披露来源，不把真实响应描述为模拟", () => {
  assert.match(render(ready()), /本排期为模拟数据（mock）/);
  const live = render(ready("live"));
  assert.match(live, /排期来源：live/);
  assert.doesNotMatch(live, /模拟数据/);
  assert.match(live, /不能据此判断今天进度或是否延期/);
  assert.match(live, /实际进场时间和现场条件仍需施工负责人确认/);
});

test("加载、失败、空排期不展示百分比或真实日期", () => {
  const loading = render({ phase: "loading", data: null, source: null, error: null });
  assert.match(loading, /本页数据可能包含模拟数据，加载完成后显示具体来源/);
  assert.doesNotMatch(loading, /本排期为模拟数据|排期来源：live|progressbar/);
  const failed = render({ phase: "failed", data: null, source: null, error: "HTTP 501" });
  assert.match(failed, /HTTP 501/);
  assert.match(failed, /重新加载/);
  assert.doesNotMatch(failed, /progressbar|工序全部完成/);
  const empty = render({ ...ready(), data: { ...schedule, tasks: [] } });
  assert.match(empty, /接口没有返回任何工序/);
  assert.match(empty, /排期来源：mock/);
  assert.doesNotMatch(empty, /progressbar|100%/);
});

test("有排期时返回链接仍保留编码后的原需求 ID", () => {
  const id = "需求/a?#";
  const html = render({ ...ready(), data: { ...schedule, demandId: id } }, id);
  assert.ok(html.includes(`/owner/demand/${encodeURIComponent(id)}`));
});

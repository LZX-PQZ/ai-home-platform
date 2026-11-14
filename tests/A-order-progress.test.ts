import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderProgressInput, type OrderSummaryDTO, type ScheduleDTO } from "../src/contracts";
import {
  availableProgressActions,
  buildOrderProgressInput,
  orderProgressErrorMessage,
} from "../src/features/a/order-progress";
import { ApiClientError } from "../src/lib/api-client";
import { OrderProgressPanel } from "../src/features/a/OrderProgressPanel";
import { ScheduleContent } from "../src/features/a/SchedulePanel";

Object.defineProperty(globalThis, "React", { configurable: true, value: React });

const order = (status: OrderSummaryDTO["status"]): OrderSummaryDTO => ({
  id: "order-1", demandId: "demand-1", providerId: "provider-a", acceptedQuoteId: "quote-1", status, source: "mock",
});
const schedule = (statuses: ScheduleDTO["tasks"][number]["status"][]): ScheduleDTO => ({
  demandId: "demand-1", version: 3,
  tasks: statuses.map((status, index) => ({
    id: `task-${index}`, name: `工序${index + 1}`, startDay: index, durationDays: 1,
    dependsOn: index === 0 ? [] : [`task-${index - 1}`], responsibleProviderId: "provider-a", status,
  })),
});

test("严格按接单状态和前置工序筛选动作", () => {
  assert.deepEqual(availableProgressActions(order("contracted"), schedule(["pending"])).map(item => item.action), ["start"]);
  assert.deepEqual(availableProgressActions(order("in_progress"), schedule(["done", "pending"])).map(item => item.taskId), ["task-1"]);
  assert.deepEqual(availableProgressActions(order("in_progress"), schedule(["done", "active"])).map(item => item.action), ["complete_task"]);
  assert.deepEqual(availableProgressActions(order("in_progress"), schedule(["done", "done"])).map(item => item.action), ["complete"]);
  assert.deepEqual(availableProgressActions(order("contracted"), schedule(["active"])), []);
});

test("输入始终使用当前排期版本、confirmed true 和公共契约", () => {
  const input = buildOrderProgressInput("demand-1", "order-1", schedule(["done", "active"]), { action: "complete_task", taskId: "task-1" });
  assert.deepEqual(input, { demandId: "demand-1", orderId: "order-1", confirmed: true, scheduleVersion: 3, action: "complete_task", taskId: "task-1" });
  assert.equal(OrderProgressInput.safeParse(input).success, true);
  const noSchedule = buildOrderProgressInput("demand-1", "order-1", null, { action: "start" });
  assert.equal(noSchedule.scheduleVersion, null);
});

test("409、503、网络错误和 501 都保留为未确认结果", () => {
  assert.match(orderProgressErrorMessage(new ApiClientError("conflict", "SCHEDULE_VERSION_CONFLICT", 409)), /没有自动重发/);
  assert.match(orderProgressErrorMessage(new ApiClientError("unavailable", "TEMPORARY_UNAVAILABLE", 503)), /重新加载/);
  assert.match(orderProgressErrorMessage(new ApiClientError("not ready", "NOT_IMPLEMENTED", 501)), /没有当作成功/);
  assert.match(orderProgressErrorMessage(new ApiClientError("network", "NETWORK_ERROR", 0)), /没有自动重发/);
});

test("订单状态在业主面板使用中文文案", () => {
  const html = renderToStaticMarkup(createElement(OrderProgressPanel, {
    demandId: "demand-1", order: order("in_progress"), schedule: null, source: "live", reload() {},
  }));
  assert.match(html, /当前状态 施工中/);
  assert.doesNotMatch(html, /当前状态 in_progress/);
});

test("无排期的真实需求仍显示履约面板，模拟排期只读且不读取接单失败卡片", () => {
  const missingHtml = renderToStaticMarkup(createElement(ScheduleContent, {
    id: "real-demand", state: { phase: "missing", data: null, source: null, error: null }, reload() {},
    orderState: { phase: "ready", order: order("contracted"), source: "live" }, reloadOrder() {},
  }));
  assert.match(missingHtml, /履约推进/);
  assert.match(missingHtml, /确认开工/);

  const demoHtml = renderToStaticMarkup(createElement(ScheduleContent, {
    id: "demo-demand", state: { phase: "ready", data: { ...schedule(["pending"]), demandId: "demo-demand" }, source: "mock", error: null }, reload() {},
    orderState: { phase: "failed", error: "请先登录业主账号" }, reloadOrder() {},
  }));
  assert.match(demoHtml, /演示只读/);
  assert.doesNotMatch(demoHtml, /接单读取失败|请先登录业主账号/);
});

import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderProgressInput, type OrderSummaryDTO, type ScheduleDTO } from "../src/contracts";
import { ScheduleContent } from "../src/features/a/SchedulePanel";
import type { ScheduleState } from "../src/features/a/useSchedule";
import { OrderProgressPanel } from "../src/features/a/OrderProgressPanel";
import {
  availableProgressActions,
  buildOrderProgressInput,
  orderProgressErrorMessage,
} from "../src/features/a/order-progress";
import { ApiClientError } from "../src/lib/api-client";

Object.defineProperty(globalThis, "React", { configurable: true, value: React });

const order = (status: OrderSummaryDTO["status"]): OrderSummaryDTO => ({
  id: "order-1", demandId: "demand-1", providerId: "provider-a", acceptedQuoteId: "quote-1", status, source: "mock",
});
const schedule = (statuses: ScheduleDTO["tasks"][number]["status"][], demandId = "demand-1"): ScheduleDTO => ({
  demandId, version: 3,
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

test("订单状态显示中文，不直接暴露英文枚举", () => {
  const html = renderToStaticMarkup(createElement(OrderProgressPanel, {
    demandId: "demand-1",
    order: order("in_progress"),
    schedule: null,
    source: "live",
    reload() {},
  }));
  assert.match(html, /当前状态 施工中/);
  assert.doesNotMatch(html, /当前状态 in_progress/);
});

test("真实需求没有排期时仍显示履约推进和确认开工", () => {
  const state: ScheduleState = { phase: "missing", data: null, source: null, error: null };
  const html = renderToStaticMarkup(createElement(ScheduleContent, {
    id: "demand-1",
    state,
    reload() {},
    orderState: { phase: "ready", order: order("contracted"), source: "live" },
    reloadOrder() {},
  }));
  assert.match(html, /履约推进/);
  assert.match(html, /确认开工/);
});

test("演示排期显示演示只读，不出现接单读取失败", () => {
  const state: ScheduleState = {
    phase: "ready",
    source: "mock",
    error: null,
    data: schedule(["pending"], "demo-demand"),
  };
  const html = renderToStaticMarkup(createElement(ScheduleContent, {
    id: "demo-demand",
    state,
    reload() {},
    orderState: { phase: "failed", error: "请先登录业主账号，才能读取本人接单。" },
    reloadOrder() {},
  }));
  assert.match(html, /演示只读/);
  assert.doesNotMatch(html, /接单读取失败|请先登录业主账号/);
});

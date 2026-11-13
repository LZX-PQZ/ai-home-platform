import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoInspectionPanel } from "../src/features/a/PhotoInspectionPanel";
import { photoInspectionStatus } from "../src/features/a/photo-inspection";

const previousReact = Object.getOwnPropertyDescriptor(globalThis, "React");
before(() => Object.defineProperty(globalThis, "React", { configurable: true, value: React }));
after(() => {
  if (previousReact) Object.defineProperty(globalThis, "React", previousReact);
  else Reflect.deleteProperty(globalThis, "React");
});

test("照片辅助检查首屏明确来源未知，并提示只能辅助发现疑点", () => {
  const html = renderToStaticMarkup(createElement(PhotoInspectionPanel, { demandId: "d-1" }));
  assert.match(html, /照片辅助检查/);
  assert.match(html, /来源：未确认/);
  assert.match(html, /只能提示疑点/);
  assert.match(html, /不能替代现场检测或证明施工合格/);
  assert.match(html, /当前不会自动确认验收/);
  assert.match(html, /disabled/);
});

test("照片检查状态只描述选择和 501，不生成验收成功结论", () => {
  assert.match(photoInspectionStatus("idle", 0), /尚未选择照片/);
  assert.match(photoInspectionStatus("selected", 2), /已选择 2 张照片/);
  const unavailable = photoInspectionStatus("unavailable", 2);
  assert.match(unavailable, /501/);
  assert.doesNotMatch(unavailable, /已验收|验收合格/);
});

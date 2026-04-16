import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsItemHeader } from "./SettingsItemHeader";

test("SettingsItemHeader renders an info tooltip trigger when description is provided", () => {
  const markup = renderToStaticMarkup(
    <SettingsItemHeader label="自动创建日程" description="控制来自邮箱或日历的新日程是直接加入 Daily，还是总是先提醒你。" />
  );

  assert.match(markup, /自动创建日程/);
  assert.match(markup, /settings-item-header__tooltip-trigger/);
  assert.match(markup, /type="button"/);
  assert.match(markup, /aria-label="显示“自动创建日程”说明"/);
  assert.doesNotMatch(markup, /控制来自邮箱或日历的新日程是直接加入 Daily，还是总是先提醒你。<\/p>/);
  assert.doesNotMatch(markup, /title=/);
});

test("SettingsItemHeader does not render an info tooltip trigger when description is missing", () => {
  const markup = renderToStaticMarkup(<SettingsItemHeader label="主题" />);

  assert.match(markup, />主题</);
  assert.doesNotMatch(markup, /title=/);
});

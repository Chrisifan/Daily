import test from "node:test";
import assert from "node:assert/strict";
import { parseIcsContent } from "./ics-parser.js";

test("parseIcsContent parses VEVENT entries with TZID parameters", () => {
  const icsText = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daily Test//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "UID:event-123",
    "DTSTART;TZID=Asia/Shanghai:20260416T090000",
    "DTEND;TZID=Asia/Shanghai:20260416T100000",
    "SUMMARY:Design Review",
    "DESCRIPTION:Review the current implementation.",
    "LOCATION:Meeting Room A",
    "ATTENDEE;CN=Alice:mailto:alice@example.com",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const events = parseIcsContent(icsText, 42, "<message-id@example.com>");

  assert.equal(events.length, 1);
  assert.equal(events[0]?.uid, "event-123");
  assert.equal(events[0]?.summary, "Design Review");
  assert.equal(events[0]?.timezone, "Asia/Shanghai");
  assert.equal(events[0]?.attendees?.[0]?.address, "alice@example.com");
});

test("parseIcsContent normalizes text fields with ICS parameters into strings", () => {
  const icsText = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:event-with-text-params",
    "DTSTART:20260416T090000Z",
    "SUMMARY;LANGUAGE=zh-CN:测试会议",
    "DESCRIPTION;ALTREP=\"cid:part1\":这是一条说明",
    "LOCATION;LANGUAGE=zh-CN:会议室 A",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const events = parseIcsContent(icsText);

  assert.equal(events.length, 1);
  assert.equal(events[0]?.summary, "测试会议");
  assert.equal(events[0]?.description, "这是一条说明");
  assert.equal(events[0]?.location, "会议室 A");
});

test("parseIcsContent strips HTML-like markup from event descriptions", () => {
  const icsText = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:event-with-html-description",
    "DTSTART:20260416T090000Z",
    "SUMMARY:测试会议邀请",
    "DESCRIPTION:<span style=\\\"color:#747a8c\\\">邮件附件：（请在邮件中查看）</span> 1) calendar.ics <span style=\\\"color:#747a8c\\\">邮件正文：</span><div style=\\\"font-family:Source Han Sans;font-size:14px;line-height:1.5;\\\">测试会议邀请</div>",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const events = parseIcsContent(icsText);

  assert.equal(events.length, 1);
  assert.equal(
    events[0]?.description,
    "邮件附件：（请在邮件中查看） 1) calendar.ics 邮件正文：\n测试会议邀请"
  );
});

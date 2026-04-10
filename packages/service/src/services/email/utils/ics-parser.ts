/**
 * ICS 日历邀请解析工具
 * 解析 .ics 格式的日历邀请，提取 VEVENT、VCALENDAR 等标准字段
 */

import { IcsEvent } from "../models/email.js";
import ical, { Component, Event } from "ical";

/**
 * 解析 .ics 格式的日历邀请文本
 * @param icsText - ICS 文件原始文本
 * @param sourceEmailUid - 来源邮件 UID（可选）
 * @param sourceEmailMessageId - 来源邮件 Message-ID（可选）
 * @returns 解析出的日历事件列表
 */
export function parseIcsContent(
  icsText: string,
  sourceEmailUid?: number,
  sourceEmailMessageId?: string
): IcsEvent[] {
  if (!icsText || typeof icsText !== "string") {
    return [];
  }

  try {
    // 使用 ical.js 解析
    const data = ical.parse(icsText);

    if (!data || typeof data !== "object") {
      return [];
    }

    const events: IcsEvent[] = [];

    // 遍历所有组件，提取 VEVENT
    for (const key of Object.keys(data)) {
      const item = data[key] as Component | Event | unknown;

      if (!item || typeof item !== "object") {
        continue;
      }

      const component = item as Component;

      // 跳过非组件对象（如 prodid 元信息）
      if (component.type !== "VCALENDAR") {
        continue;
      }

      // VCALENDAR 可能嵌套 VEVENT
      const vevents = component.subcomponents?.filter(
        (sub: Component) => sub.type === "VEVENT"
      );

      if (vevents) {
        for (const vevent of vevents) {
          const event = parseVEvent(vevent, sourceEmailUid, sourceEmailMessageId, icsText);
          if (event) {
            events.push(event);
          }
        }
      }

      // 直接在 data 上有 VEVENT 的情况（ical.js 不同版本的格式差异）
      if (component.events) {
        for (const vevent of component.events as Event[]) {
          const event = parseVEventObject(vevent, sourceEmailUid, sourceEmailMessageId, icsText);
          if (event) {
            events.push(event);
          }
        }
      }
    }

    // 兼容：直接遍历 data 找 VEVENT
    if (events.length === 0) {
      for (const key of Object.keys(data)) {
        const item = data[key];
        if (item && typeof item === "object" && (item as Component).type === "VEVENT") {
          const event = parseVEvent(item as Component, sourceEmailUid, sourceEmailMessageId, icsText);
          if (event) {
            events.push(event);
          }
        }
      }
    }

    return events;
  } catch (error) {
    // ical.js 解析失败，尝试手动正则解析（兜底方案）
    console.warn("[ics-parser] ical.js 解析失败，尝试正则解析:", error);
    return parseIcsWithRegex(icsText, sourceEmailUid, sourceEmailMessageId);
  }
}

/**
 * 从 VEVENT 组件解析事件
 */
function parseVEvent(
  vevent: Component,
  sourceEmailUid?: number,
  sourceEmailMessageId?: string,
  rawIcs?: string
): IcsEvent | null {
  try {
    if (!vevent || !vevent.properties) {
      return null;
    }

    const props = vevent.properties;

    // 提取 UID
    const uid = getPropValue<string>(props, "uid", true) ?? "";

    // 提取时间（核心字段）
    const dtstart = extractDateTime(props, "dtstart");
    const dtend = extractDateTime(props, "dtend") ?? extractDateTime(props, "duration");
    const allDay = isAllDayEvent(props);

    if (!dtstart) {
      return null; // 没有开始时间的事件无效
    }

    // 提取 SUMMARY
    const summary = getPropValue<string>(props, "summary", false) ?? undefined;

    // 提取 DESCRIPTION
    const description = getPropValue<string>(props, "description", false) ?? undefined;

    // 提取 LOCATION
    const location = getPropValue<string>(props, "location", false) ?? undefined;

    // 提取 ORGANIZER
    const organizer = parseOrganizer(props);

    // 提取 ATTENDEE
    const attendees = parseAttendees(props);

    // 提取 METHOD
    const methodStr = getPropValue<string>(props, "method", false);
    const method = normalizeMethod(methodStr);

    // 提取 RRULE（重复规则）
    const rrule = getPropValue<string>(props, "rrule", false) ?? undefined;

    // 提取 STATUS
    const statusStr = getPropValue<string>(props, "status", false);
    const status = normalizeStatus(statusStr);

    // 提取 SEQUENCE
    const sequenceStr = getPropValue<string | number>(props, "sequence", false);
    const sequence = typeof sequenceStr === "number" ? sequenceStr : parseInt(String(sequenceStr ?? "0"), 10);

    return {
      uid,
      summary,
      description,
      start: dtstart,
      end: dtend,
      timezone: getTimezone(props),
      location,
      organizer,
      attendees: attendees && attendees.length > 0 ? attendees : undefined,
      allDay,
      method,
      recurrence: rrule,
      status,
      sequence,
      sourceEmailUid,
      sourceEmailMessageId,
      rawIcs,
    };
  } catch (error) {
    console.error("[ics-parser] VEVENT 解析错误:", error);
    return null;
  }
}

/**
 * 解析 ical.js 的 Event 对象
 */
function parseVEventObject(
  vevent: Event,
  sourceEmailUid?: number,
  sourceEmailMessageId?: string,
  rawIcs?: string
): IcsEvent | null {
  try {
    if (!vevent) {
      return null;
    }

    const start = vevent.start ? new Date(vevent.start) : undefined;
    if (!start || isNaN(start.getTime())) {
      return null;
    }

    const end = vevent.end ? new Date(vevent.end) : undefined;
    const allDay = vevent.allDay ?? false;

    let organizer;
    if (vevent.organizer) {
      organizer = parseEmailAddress(vevent.organizer as string);
    }

    let attendees: IcsEvent["attendees"] = [];
    if (vevent.attendee) {
      const attendeeList = Array.isArray(vevent.attendee)
        ? vevent.attendee
        : [vevent.attendee];
      attendees = attendeeList
        .map((a) => parseEmailAddress(a as string))
        .filter(Boolean) as IcsEvent["attendees"];
    }

    return {
      uid: vevent.uid ?? "",
      summary: vevent.summary,
      description: vevent.description,
      start,
      end,
      allDay,
      location: vevent.location,
      organizer,
      attendees: attendees && attendees.length > 0 ? attendees : undefined,
      method: normalizeMethod(vevent.method as string),
      recurrence: vevent.rrule as string,
      status: normalizeStatus(vevent.status as string),
      sequence: vevent.sequence,
      sourceEmailUid,
      sourceEmailMessageId,
      rawIcs,
    };
  } catch (error) {
    console.error("[ics-parser] Event 对象解析错误:", error);
    return null;
  }
}

/**
 * 手动正则解析 ICS（兜底方案）
 */
function parseIcsWithRegex(
  icsText: string,
  sourceEmailUid?: number,
  sourceEmailMessageId?: string
): IcsEvent[] {
  const events: IcsEvent[] = [];

  // 提取所有 VEVENT 块
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
  let match;

  while ((match = veventRegex.exec(icsText)) !== null) {
    const veventText = match[0];
    const event = parseVEventText(
      veventText,
      sourceEmailUid,
      sourceEmailMessageId,
      icsText
    );
    if (event) {
      events.push(event);
    }
  }

  return events;
}

/**
 * 解析 VEVENT 文本块
 */
function parseVEventText(
  veventText: string,
  sourceEmailUid?: number,
  sourceEmailMessageId?: string,
  rawIcs?: string
): IcsEvent | null {
  try {
    // 提取 UID
    const uid = extractLine(veventText, "UID") ?? "";

    // 提取 DTSTART
    const dtstartStr = extractLine(veventText, "DTSTART");
    const dtstart = parseIcsDateTime(dtstartStr);
    if (!dtstart) {
      return null;
    }

    // 提取 DTEND
    const dtendStr = extractLine(veventText, "DTEND") ?? extractLine(veventText, "DURATION");
    const dtend = parseIcsDateTime(dtendStr);

    // 判断全天事件
    const allDay = dtstartStr?.toUpperCase().includes("VALUE=DATE") ||
      !dtstartStr?.includes("T");

    // 提取其他字段
    const summary = extractLine(veventText, "SUMMARY") ?? undefined;
    const description = extractLine(veventText, "DESCRIPTION") ?? undefined;
    const location = extractLine(veventText, "LOCATION") ?? undefined;

    // 提取 ORGANIZER
    let organizer;
    const organizerStr = extractLine(veventText, "ORGANIZER");
    if (organizerStr) {
      organizer = parseEmailAddress(organizerStr);
    }

    // 提取 ATTENDEE
    const attendeeMatches = veventText.match(/ATTENDEE[\s\S]*?(?=(?:ATTENDEE|END:VEVENT))/gi) ?? [];
    const attendees = attendeeMatches
      .map((a) => parseEmailAddress(a.replace(/^ATTENDEE:?/i, "")))
      .filter(Boolean) as IcsEvent["attendees"];

    // 提取 METHOD
    const methodStr = extractLine(rawIcs ?? "", "METHOD") ?? undefined;
    const method = normalizeMethod(methodStr);

    // 提取 STATUS
    const statusStr = extractLine(veventText, "STATUS") ?? undefined;
    const status = normalizeStatus(statusStr);

    // 提取 SEQUENCE
    const sequenceStr = extractLine(veventText, "SEQUENCE") ?? "0";
    const sequence = parseInt(sequenceStr, 10);

    // 提取 RRULE
    const rrule = extractLine(veventText, "RRULE") ?? undefined;

    return {
      uid,
      summary,
      description,
      start: dtstart,
      end: dtend,
      allDay,
      location,
      organizer,
      attendees: attendees && attendees.length > 0 ? attendees : undefined,
      method,
      recurrence: rrule,
      status,
      sequence,
      sourceEmailUid,
      sourceEmailMessageId,
      rawIcs,
    };
  } catch (error) {
    console.error("[ics-parser] VEVENT 文本解析错误:", error);
    return null;
  }
}

// ==================== 工具函数 ====================

/**
 * 提取 ICS 行（支持多行折叠）
 */
function extractLine(text: string, key: string): string | undefined {
  if (!text) {
    return undefined;
  }
  // 处理多行折叠（行以空格或 tab 开头表示续行）
  const regex = new RegExp(`^${key}:([\\s\\S]*?)(?=^\\w|$$)`, "mi");
  const match = text.match(regex);
  if (match) {
    // 处理多行折叠：把换行 + 空格/tab 替换为单行
    return match[1].replace(/\r?\n[\t ]/g, "").trim();
  }
  return undefined;
}

/**
 * 解析 ICS 日期时间格式
 * 支持：YYYYMMDDTHHMMSSZ, YYYYMMDD, YYYYMMDDTHHMMSS
 */
function parseIcsDateTime(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  // 去掉 VALUE=DATE 等参数
  const datetime = value.replace(/;.*$/, "").trim();
  if (!datetime) {
    return undefined;
  }

  // 全天事件（只有日期）
  if (/^\d{8}$/.test(datetime)) {
    const year = parseInt(datetime.slice(0, 4), 10);
    const month = parseInt(datetime.slice(4, 6), 10) - 1;
    const day = parseInt(datetime.slice(6, 8), 10);
    return new Date(year, month, day);
  }

  // 带时间的日期
  const parsed = new Date(datetime);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // 手动解析 YYYYMMDDTHHMMSSZ
  const withTimeMatch = datetime.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/
  );
  if (withTimeMatch) {
    const [, year, month, day, hour, minute, second, z] = withTimeMatch;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
    if (z) {
      date.setTime(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    }
    return date;
  }

  return undefined;
}

/**
 * 从属性中提取日期时间
 */
function extractDateTime(
  props: Record<string, unknown>,
  key: string
): Date | undefined {
  const value = props[key];
  if (!value) {
    return undefined;
  }

  // ical.js 格式
  if (typeof value === "object" && value !== null && "value" in (value as Record<string, unknown>)) {
    const val = (value as Record<string, unknown>).value;
    if (val instanceof Date) {
      return val;
    }
    if (typeof val === "string") {
      return parseIcsDateTime(val);
    }
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    return parseIcsDateTime(value);
  }

  return undefined;
}

/**
 * 判断是否为全天事件
 */
function isAllDayEvent(props: Record<string, unknown>): boolean {
  const dtstart = props["dtstart"];
  if (typeof dtstart === "object" && dtstart !== null) {
    const dtstartObj = dtstart as Record<string, unknown>;
    if (dtstartObj.value === "DATE" || dtstartObj.type === "DATE") {
      return true;
    }
  }
  return false;
}

/**
 * 获取时区
 */
function getTimezone(props: Record<string, unknown>): string | undefined {
  const dtstart = props["dtstart"];
  if (typeof dtstart === "object" && dtstart !== null) {
    const dtstartObj = dtstart as Record<string, unknown>;
    const tzid = dtstartObj.parameters as Record<string, unknown> | undefined;
    if (tzid?.tzid) {
      return tzid.tzid as string;
    }
  }
  return undefined;
}

/**
 * 获取属性值
 */
function getPropValue<T>(
  props: Record<string, unknown>,
  key: string,
  required: boolean
): T | undefined {
  const value = props[key];
  if (!value) {
    if (required) {
      console.warn(`[ics-parser] 缺少必需字段: ${key}`);
    }
    return undefined;
  }

  if (typeof value === "object" && value !== null && "value" in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>).value as T;
  }

  return value as T;
}

/**
 * 解析邮箱地址（从 ORGANIZER、ATTENDEE 等字段）
 * 格式: MAILTO:user@example.com 或 user@example.com
 */
function parseEmailAddress(value: string | undefined): IcsEvent["organizer"] {
  if (!value) {
    return undefined;
  }

  const email = value.replace(/^MAILTO:/i, "").trim();
  const nameMatch = value.match(/CN=([^;:]+)/i);

  return {
    address: email,
    name: nameMatch ? nameMatch[1].trim() : undefined,
  };
}

/**
 * 解析 ORGANIZER
 */
function parseOrganizer(props: Record<string, unknown>): IcsEvent["organizer"] {
  const value = getPropValue<string>(props, "organizer", false);
  return parseEmailAddress(value);
}

/**
 * 解析 ATTENDEE 列表
 */
function parseAttendees(props: Record<string, unknown>): IcsEvent["attendees"] {
  const value = props["attendee"];
  if (!value) {
    return [];
  }

  const list = Array.isArray(value) ? value : [value];
  return list
    .map((v) => {
      if (typeof v === "string") {
        return parseEmailAddress(v);
      }
      if (typeof v === "object" && v !== null && "value" in (v as Record<string, unknown>)) {
        return parseEmailAddress((v as Record<string, unknown>).value as string);
      }
      return undefined;
    })
    .filter(Boolean) as IcsEvent["attendees"];
}

/**
 * 规范化 METHOD 字段
 */
function normalizeMethod(
  method: string | undefined
): IcsEvent["method"] {
  if (!method) {
    return undefined;
  }
  const upper = method.toUpperCase();
  if (["REQUEST", "CANCEL", "REPLY", "PUBLISH"].includes(upper)) {
    return upper as IcsEvent["method"];
  }
  return undefined;
}

/**
 * 规范化 STATUS 字段
 */
function normalizeStatus(
  status: string | undefined
): IcsEvent["status"] {
  if (!status) {
    return undefined;
  }
  const upper = status.toUpperCase();
  if (["CONFIRMED", "TENTATIVE", "CANCELLED"].includes(upper)) {
    return upper as IcsEvent["status"];
  }
  return undefined;
}

/**
 * 检测文本是否包含 ICS 日历邀请
 */
export function detectIcsContent(text: string): boolean {
  return /BEGIN:VCALENDAR/i.test(text) && /BEGIN:VEVENT/i.test(text);
}

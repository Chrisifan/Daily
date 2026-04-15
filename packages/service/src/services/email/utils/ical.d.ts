/**
 * Type declarations for ical module
 * ical.js 0.8.x 没有官方 TypeScript 类型声明
 */

declare module "ical" {
  export interface EmailAddress {
    address?: string | undefined;
    name: string;
    group?: EmailAddress[] | undefined;
  }

  export interface Component {
    type: string;
    properties: Record<string, unknown>;
    subcomponents?: Component[];
    events?: Event[];
  }

  export interface Event {
    type?: string;
    uid?: string;
    summary?: string;
    description?: string;
    start?: Date | string;
    end?: Date | string;
    allDay?: boolean;
    location?: string;
    organizer?: string | { params?: { CN?: string }; val?: string };
    attendee?:
      | string
      | { params?: { CN?: string }; val?: string }
      | Array<string | { params?: { CN?: string }; val?: string }>;
    method?: string;
    rrule?: string;
    status?: string;
    sequence?: number;
    value?: unknown;
    params?: unknown;
  }

  export interface ParsedCalendar {
    [key: string]: Component | Event | unknown;
  }

  export function parseICS(input: string): ParsedCalendar;
}

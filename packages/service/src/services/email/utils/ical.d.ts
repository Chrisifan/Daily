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
    organizer?: string;
    attendee?: string | string[];
    method?: string;
    rrule?: string;
    status?: string;
    sequence?: number;
    value?: unknown;
  }

  export interface ParsedCalendar {
    [key: string]: Component | Event | unknown;
  }

  export function parse(input: string): ParsedCalendar;
}

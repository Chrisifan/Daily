import { format } from 'date-fns';

export const ROUTINE_STEP_MINUTES = 30;
export const MINUTES_IN_DAY = 24 * 60;

export function parseRoutineTime(value: string): number {
  const [hoursPart = '0', minutesPart = '0'] = value.split(':');
  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

export function normalizeRoutineEndMinutes(startMinutes: number, endMinutes: number): number {
  return endMinutes <= startMinutes ? endMinutes + MINUTES_IN_DAY : endMinutes;
}

export function isRoutineRangeValid(startTime: string, endTime: string): boolean {
  const startMinutes = parseRoutineTime(startTime);
  const endMinutes = normalizeRoutineEndMinutes(startMinutes, parseRoutineTime(endTime));
  return endMinutes - startMinutes >= ROUTINE_STEP_MINUTES;
}

export function buildDateFromRoutineMinutes(baseDate: Date, totalMinutes: number): Date {
  const nextDate = new Date(baseDate);
  const dayOffset = Math.floor(totalMinutes / MINUTES_IN_DAY);
  const minuteOfDay = ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

  nextDate.setDate(baseDate.getDate() + dayOffset);
  nextDate.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);

  return nextDate;
}

export function formatRoutineTimeLabel(
  value: string,
  displayFormat: 'HH:mm' | 'hh:mm A',
  treatMidnightAsEndOfDay: boolean = false
): string {
  if (displayFormat === 'HH:mm' && treatMidnightAsEndOfDay && value === '00:00') {
    return '24:00';
  }

  const minutes = parseRoutineTime(value);
  const date = new Date(2024, 0, 1, Math.floor(minutes / 60), minutes % 60, 0, 0);
  return format(date, displayFormat === 'hh:mm A' ? 'hh:mm a' : 'HH:mm');
}

export function createRoutineTimeOptions(): string[] {
  return Array.from({ length: MINUTES_IN_DAY / ROUTINE_STEP_MINUTES }, (_, index) => {
    const totalMinutes = index * ROUTINE_STEP_MINUTES;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  });
}

export function createRoutineSelectableTimeOptions(
  startTime: string,
  endTime: string,
  stepMinutes: number = ROUTINE_STEP_MINUTES
): string[] {
  const startMinutes = parseRoutineTime(startTime);
  const normalizedEndMinutes = Math.min(
    normalizeRoutineEndMinutes(startMinutes, parseRoutineTime(endTime)),
    MINUTES_IN_DAY
  );
  const normalizedStepMinutes = Math.max(stepMinutes, 1);

  if (normalizedEndMinutes - startMinutes < ROUTINE_STEP_MINUTES) {
    return [startTime];
  }

  const options: string[] = [];
  for (
    let minutes = startMinutes;
    minutes < normalizedEndMinutes;
    minutes += normalizedStepMinutes
  ) {
    const normalizedMinutes = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    const hours = Math.floor(normalizedMinutes / 60);
    const remainingMinutes = normalizedMinutes % 60;
    options.push(
      `${hours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}`
    );
  }

  return options;
}

export function getNextRoutineSelectableDateTime(
  now: Date,
  startTime: string,
  endTime: string
): Date {
  const startMinutes = parseRoutineTime(startTime);
  const normalizedEndMinutes = Math.min(
    normalizeRoutineEndMinutes(startMinutes, parseRoutineTime(endTime)),
    MINUTES_IN_DAY
  );
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const nextSlotMinutes =
    Math.floor(currentMinutes / ROUTINE_STEP_MINUTES) * ROUTINE_STEP_MINUTES + ROUTINE_STEP_MINUTES;

  if (nextSlotMinutes <= startMinutes) {
    return buildDateFromRoutineMinutes(now, startMinutes);
  }

  if (nextSlotMinutes < normalizedEndMinutes) {
    return buildDateFromRoutineMinutes(now, nextSlotMinutes);
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return buildDateFromRoutineMinutes(tomorrow, startMinutes);
}

import type { Priority } from '../../domain/schedule/types';

interface PriorityStyle {
  color: string;
  text: string;
  border: string;
  ring: string;
  softBackground: string;
  solidBackground: string;
  selectedBackground: string;
  selectedColor: string;
  selectedBoxShadow: string;
  zIndex: number;
}

export const PRIORITY_STYLES: Record<Priority, PriorityStyle> = {
  high: {
    color: 'var(--color-priority-high)',
    text: 'var(--color-priority-high-text)',
    border: 'var(--color-priority-high-border)',
    ring: 'var(--color-priority-high-ring)',
    softBackground: 'var(--color-priority-high-surface)',
    solidBackground: 'var(--color-priority-high-solid)',
    selectedBackground: 'var(--color-priority-high-selected)',
    selectedColor: 'var(--color-priority-high-contrast)',
    selectedBoxShadow: 'var(--color-priority-high-shadow)',
    zIndex: 50,
  },
  medium: {
    color: 'var(--color-priority-medium)',
    text: 'var(--color-priority-medium-text)',
    border: 'var(--color-priority-medium-border)',
    ring: 'var(--color-priority-medium-ring)',
    softBackground: 'var(--color-priority-medium-surface)',
    solidBackground: 'var(--color-priority-medium-solid)',
    selectedBackground: 'var(--color-priority-medium-selected)',
    selectedColor: 'var(--color-priority-medium-contrast)',
    selectedBoxShadow: 'var(--color-priority-medium-shadow)',
    zIndex: 40,
  },
  low: {
    color: 'var(--color-priority-low)',
    text: 'var(--color-priority-low-text)',
    border: 'var(--color-priority-low-border)',
    ring: 'var(--color-priority-low-ring)',
    softBackground: 'var(--color-priority-low-surface)',
    solidBackground: 'var(--color-priority-low-solid)',
    selectedBackground: 'var(--color-priority-low-selected)',
    selectedColor: 'var(--color-priority-low-contrast)',
    selectedBoxShadow: 'var(--color-priority-low-shadow)',
    zIndex: 30,
  },
};

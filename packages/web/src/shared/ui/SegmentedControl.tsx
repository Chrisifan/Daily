import type { ReactNode } from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  selectedBackground?: string;
  selectedColor?: string;
  selectedBoxShadow?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  fullWidth = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex max-w-full items-center gap-1 rounded-[14px] p-1 ${fullWidth ? 'w-full' : ''}`}
      style={{
        border: '1px solid var(--color-border)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent), color-mix(in srgb, var(--color-surface-elevated, var(--color-surface)) 92%, var(--color-bg) 8%))',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        const defaultSelectedBackground =
          'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary-hover, var(--color-primary)) 88%, white 12%))';
        const defaultSelectedColor = 'var(--color-surface)';
        const defaultSelectedBoxShadow =
          '0 8px 18px color-mix(in srgb, var(--color-primary) 20%, transparent)';

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-[10px] px-4 text-[13px] font-medium transition-all ${fullWidth ? 'flex-1' : ''}`}
            style={{
              background: isSelected
                ? (opt.selectedBackground ?? defaultSelectedBackground)
                : 'transparent',
              color: isSelected ? (opt.selectedColor ?? defaultSelectedColor) : 'var(--color-text-secondary)',
              boxShadow: isSelected
                ? (opt.selectedBoxShadow ?? defaultSelectedBoxShadow)
                : 'none',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

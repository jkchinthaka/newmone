import type { ChangeEvent, MouseEvent } from "react";

/**
 * Checkbox with a 44x44px hit area (WCAG 2.5.5 / gloved, on-the-floor phone use).
 * The visible box stays small; the surrounding label takes the tap.
 */
export function TouchCheckbox({
  checked,
  onChange,
  label,
  disabled,
  className = ""
}: {
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`-m-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100 ${className}`}
      onClick={(event: MouseEvent<HTMLLabelElement>) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        className="h-5 w-5 cursor-pointer accent-brand-600"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={onChange}
      />
    </label>
  );
}

"use client";

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Unit shown inside the field, e.g. `€`, `%`, `Jahre`. */
  suffix?: string;
  /** What the field is for. Shown while the value is acceptable. */
  hint?: string;
  /** What is wrong. Replaces the hint while the value is not acceptable. */
  error?: string;
  invalid?: boolean;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
  error,
  invalid = false,
}: NumberFieldProps) {
  // An invalid field has to say what is wrong. Recolouring the description red
  // marks the field as in error while explaining nothing — and a screen reader
  // then announces "invalid" followed by a sentence about what the field is for.
  const message = invalid ? (error ?? hint) : hint;
  const describedBy = message ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          // Text rather than number: German users type a decimal comma, which
          // a number input silently discards in most browsers.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={`w-full rounded-lg border bg-surface px-3 py-2 text-right tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ${
            invalid ? "border-error" : "border-border"
          } ${suffix ? "pr-12" : ""}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
      {message ? (
        <p
          id={describedBy}
          className={`text-xs ${invalid ? "text-error" : "text-muted"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

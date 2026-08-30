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
  // The unit is part of what the field expects, so it is described rather than
  // decorative: "Anlagedauer, Jahre" reads as one instruction, where a silent
  // suffix leaves a screen reader user guessing between years and months.
  const describedBy =
    [suffix ? `${id}-suffix` : null, message ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {/* With a unit, the border belongs to the wrapper so that the unit sits
          inside the field rather than on top of the value. */}
      <div className={suffix ? "field-input field-shell" : undefined}>
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
          className={`text-right tabular-nums ${suffix ? "" : "field-input"}`}
        />
        {suffix ? (
          <span id={`${id}-suffix`} className="field-suffix">
            {suffix}
          </span>
        ) : null}
      </div>
      {message ? (
        <p
          id={`${id}-hint`}
          className={`text-xs leading-relaxed ${
            invalid ? "text-error" : "text-muted"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

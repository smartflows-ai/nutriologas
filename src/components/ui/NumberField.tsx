"use client";
// src/components/ui/NumberField.tsx
// A numeric settings field with the shared `input` style. While the person types, the text is theirs: an empty or
// partial value is not committed, so clearing the field never turns it into 0 and typing never gets a leading "0".
// The parent gets only valid values (inside min and max, in steps of `step`). On blur the text is put back to the
// committed value.
import { useEffect, useRef, useState } from "react";

interface Props {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
  className?: string;
}

const EPSILON = 1e-9;

export function isValidStep(value: number, min: number, max: number, step: number): boolean {
  if (!Number.isFinite(value) || value < min || value > max) return false;
  const remainder = (value - min) / step;
  return Math.abs(remainder - Math.round(remainder)) < EPSILON;
}

export default function NumberField({ id, value, min, max, step, onCommit, className = "" }: Props) {
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // A value that changes from outside (the settings load) replaces the text, unless the person is typing in it.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      id={id}
      ref={inputRef}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        if (text.trim() === "") return;
        const parsed = Number(text);
        if (isValidStep(parsed, min, max, step)) onCommit(parsed);
      }}
      onBlur={() => setDraft(String(value))}
      className={`input ${className}`}
    />
  );
}

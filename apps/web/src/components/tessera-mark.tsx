"use client";

type Variant =
  | "purple"
  | "twotone"
  | "two-tone"
  | "mono"
  | "reversed"
  | "grey";

interface TesseraMarkProps {
  size?: number;
  variant?: Variant;
  className?: string;
}

const fills: Record<Variant, [string, string]> = {
  purple: ["#534AB7", "#534AB7"],
  twotone: ["#534AB7", "#7F77DD"],
  "two-tone": ["#534AB7", "#7F77DD"],
  mono: ["#1A1A1A", "#1A1A1A"],
  reversed: ["#FFFFFF", "#FFFFFF"],
  grey: ["#55556a", "#55556a"],
};

export function TesseraMark({
  size = 24,
  variant = "purple",
  className = "",
}: TesseraMarkProps) {
  const [left, right] = fills[variant];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 0 L42 0 L42 30 A20 20 0 0 1 42 70 L42 100 L6 100 Q0 100 0 94 L0 6 Q0 0 6 0 Z"
        fill={left}
      />
      <path
        d="M50 0 L94 0 Q100 0 100 6 L100 94 Q100 100 94 100 L50 100 L50 70 A20 20 0 0 0 50 30 Z"
        fill={right}
      />
    </svg>
  );
}

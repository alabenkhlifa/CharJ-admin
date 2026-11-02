import type { CSSProperties, ReactNode } from "react";

// The one SVG frame every app icon is drawn in (lucide-style: 24px box,
// round caps, currentColor). Its own file so icons.tsx exports only the
// Icons map (fast refresh wants component files to export components only).

export type IconProps = {
  size?: number;
  stroke?: number;
  fill?: string;
  style?: CSSProperties;
  className?: string;
};

type RawIconProps = IconProps & {
  d?: string;
  children?: ReactNode;
};

export const RawIcon = ({
  d,
  size = 16,
  stroke = 1.6,
  fill = "none",
  children,
  ...rest
}: RawIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

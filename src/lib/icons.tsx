import type { CSSProperties, ReactNode } from "react";

type IconProps = {
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

const RawIcon = ({
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

export const Icons = {
  Overview: (p: IconProps) => (
    <RawIcon {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </RawIcon>
  ),
  Charger: (p: IconProps) => (
    <RawIcon {...p}>
      <rect x="5" y="3" width="11" height="18" rx="2" />
      <path d="M9 8h3" />
      <path d="M9 12h3" />
      <path d="M16 9h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2" />
    </RawIcon>
  ),
  Submission: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </RawIcon>
  ),
  Feedback: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-9a8 8 0 0 1 8-8h2a8 8 0 0 1 8 6Z" />
    </RawIcon>
  ),
  Reviews: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9Z" />
    </RawIcon>
  ),
  Users: (p: IconProps) => (
    <RawIcon {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21.5 18.5A4.5 4.5 0 0 0 17 14" />
    </RawIcon>
  ),
  Vehicle: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M5 17h14" />
      <path d="M3 17v-4l2-5a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 8l2 5v4" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </RawIcon>
  ),
  Map: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </RawIcon>
  ),
  Settings: (p: IconProps) => (
    <RawIcon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </RawIcon>
  ),
  Search: (p: IconProps) => (
    <RawIcon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </RawIcon>
  ),
  Sun: (p: IconProps) => (
    <RawIcon {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </RawIcon>
  ),
  Moon: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </RawIcon>
  ),
  Bell: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </RawIcon>
  ),
  ChevronDown: (p: IconProps) => <RawIcon {...p} d="m6 9 6 6 6-6" />,
  ChevronRight: (p: IconProps) => <RawIcon {...p} d="m9 6 6 6-6 6" />,
  ChevronLeft: (p: IconProps) => <RawIcon {...p} d="m15 6-6 6 6 6" />,
  ArrowUp: (p: IconProps) => <RawIcon {...p} d="M12 19V5M5 12l7-7 7 7" />,
  ArrowDown: (p: IconProps) => <RawIcon {...p} d="M12 5v14M19 12l-7 7-7-7" />,
  ArrowRight: (p: IconProps) => <RawIcon {...p} d="M5 12h14M12 5l7 7-7 7" />,
  Plus: (p: IconProps) => <RawIcon {...p} d="M12 5v14M5 12h14" />,
  Filter: (p: IconProps) => <RawIcon {...p} d="M3 5h18M6 12h12M10 19h4" />,
  Download: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </RawIcon>
  ),
  Expand: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="m21 3-7 7" />
      <path d="M3 21l7-7" />
    </RawIcon>
  ),
  More: (p: IconProps) => (
    <RawIcon {...p}>
      <circle cx="12" cy="6" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="18" r="1" />
    </RawIcon>
  ),
  Check: (p: IconProps) => <RawIcon {...p} d="m5 12 4.5 4.5L20 7" />,
  X: (p: IconProps) => <RawIcon {...p} d="M6 6l12 12M6 18 18 6" />,
  Star: (p: IconProps) => (
    <RawIcon {...p} fill="currentColor" stroke={0}>
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9Z" />
    </RawIcon>
  ),
  Bolt: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
    </RawIcon>
  ),
  Pin: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </RawIcon>
  ),
  Sync: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M21 12a9 9 0 0 1-15.5 6.3" />
      <path d="M3 12a9 9 0 0 1 15.5-6.3" />
      <path d="M21 4v5h-5" />
      <path d="M3 20v-5h5" />
    </RawIcon>
  ),
  Verify: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="m12 3 2.4 1.7 2.9-.4 1 2.7 2.4 1.7-1 2.7 1 2.7-2.4 1.7-1 2.7-2.9-.4L12 21l-2.4-1.7-2.9.4-1-2.7L3.3 15.3l1-2.7-1-2.7L5.7 8l1-2.7 2.9.4Z" />
      <path d="m9 12 2 2 4-4" />
    </RawIcon>
  ),
  Inbox: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M3 13h4l2 3h6l2-3h4" />
      <path d="M5 5h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
    </RawIcon>
  ),
  TrendingUp: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </RawIcon>
  ),
  Activity: (p: IconProps) => <RawIcon {...p} d="M3 12h4l3-9 4 18 3-9h4" />,
  Clock: (p: IconProps) => (
    <RawIcon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </RawIcon>
  ),
  Sidebar: (p: IconProps) => (
    <RawIcon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </RawIcon>
  ),
  Help: (p: IconProps) => (
    <RawIcon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" />
      <path d="M12 17h.01" />
    </RawIcon>
  ),
  Command: (p: IconProps) => (
    <RawIcon {...p}>
      <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z" />
    </RawIcon>
  ),
} satisfies Record<string, (p: IconProps) => ReactNode>;

export type IconKey = keyof typeof Icons;

import type { SVGProps } from "react";

/*
 * Small inline glyphs for the chat mocks. Drawn by hand to match each app;
 * `currentColor` everywhere so the screens set the color.
 */

type P = SVGProps<SVGSVGElement>;

const base = (p: P): P => ({ width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, ...p });

export const ChevronLeftIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 4.5 7.5 12 15 19.5" />
  </svg>
);
export const ChevronRightIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);
export const ChevronDownIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const VideoIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="6.5" width="12.5" height="11" rx="2.5" />
    <path d="m15.5 10 4.5-2.5v9L15.5 14" />
  </svg>
);
export const PhoneIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.5 3.5h3l1.7 4.3-2 1.5a10 10 0 0 0 6.5 6.5l1.5-2 4.3 1.7v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2Z" />
  </svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const ArrowUpIcon = (p: P) => (
  <svg {...base({ strokeWidth: 2.5, ...p })}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);
export const MicIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
);
export const CameraIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2.5h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
export const ImageIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="9.5" r="1.5" />
    <path d="m3.5 16 5-4.5 4 3.5 3-2.5 5 4" />
  </svg>
);
export const StickerIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20.5 12a8.5 8.5 0 1 1-8.5-8.5h.5A8 8 0 0 1 20.5 12Z" />
    <path d="M20.3 13.5A6.5 6.5 0 0 0 13.5 20.3" />
    <path d="M9 10h.01M15 10h.01" strokeWidth={2.75} />
  </svg>
);
export const PaperclipIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m20.5 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.2a1.6 1.6 0 0 1-2.3-2.3L15.5 7.3" />
  </svg>
);
export const MenuIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const ComposeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5H6.5A2.5 2.5 0 0 0 4 7.5v10A2.5 2.5 0 0 0 6.5 20h10a2.5 2.5 0 0 0 2.5-2.5V12" />
    <path d="m16.5 4.5 3 3L12 15H9v-3Z" />
  </svg>
);
export const LockIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base({ strokeWidth: 3, ...p })}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const InfoIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const CopyIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
  </svg>
);
export const ThumbIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 10.5v9H4.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
    <path d="M7 10.5 11 3.5a2 2 0 0 1 2 2v4h5.2a1.5 1.5 0 0 1 1.5 1.8l-1.3 6.5a1.5 1.5 0 0 1-1.5 1.2H7" />
  </svg>
);
export const RefreshIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5" />
  </svg>
);
export const CreditCardIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M7 14.5h3" />
  </svg>
);
export const ChevronsUpDownIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4" />
  </svg>
);
export const MonitorIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="12" rx="2.5" />
    <path d="M8.5 20h7M12 16.5V20" />
  </svg>
);

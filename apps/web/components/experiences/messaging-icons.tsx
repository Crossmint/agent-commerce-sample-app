import type { SVGProps } from "react";

/*
 * Small inline glyphs for the messaging chromes. Drawn by hand to match each
 * app; `currentColor` everywhere so the chrome sets the color.
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
export const LockIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);
/** WhatsApp's two ticks, for a read message. */
export const DoubleCheckIcon = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="m2.5 12.5 4 4L15 8" />
    <path d="m10.5 16.5 1 1L21 9" />
  </svg>
);

/** WhatsApp's quick-reply arrow: a curve back to the left. */
export const ReplyIcon = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

/** WhatsApp's list-message glyph: three lines with bullets. */
export const ListIcon = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth={3} />
  </svg>
);

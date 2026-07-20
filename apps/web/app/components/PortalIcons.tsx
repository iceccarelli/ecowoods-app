const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 18,
  height: 18,
};

export function DashboardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function QuotesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4" />
      <path d="M8.5 12.5h7M8.5 16h5" />
    </svg>
  );
}

export function ProjectsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 20.5V10l8-6 8 6v10.5" />
      <path d="M9 20.5v-7h6v7" />
    </svg>
  );
}

export function InvoicesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6.5 3.5h11v17l-2.2-1.5-1.9 1.5-1.9-1.5-1.9 1.5-1.9-1.5-1.2 1.5Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3" />
    </svg>
  );
}

export function CustomersIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19c0-3 2.5-5.25 5.5-5.25S14.5 16 14.5 19" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 13.25c2.4.35 4 2.25 4 5.75" />
    </svg>
  );
}

export function InquiriesIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4.5 6.5 12 13l7.5-6.5" />
    </svg>
  );
}

export function ShopIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 8.5h12l-1 12H7Z" />
      <path d="M9 8.5V6.5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.5 7.5 0 0 0 0-3l1.8-1.4-1.5-2.6-2.1.6a7.4 7.4 0 0 0-2.6-1.5L14.6 3h-3l-.4 2.1a7.4 7.4 0 0 0-2.6 1.5l-2.1-.6-1.5 2.6 1.8 1.4a7.5 7.5 0 0 0 0 3L4.9 14.9l1.5 2.6 2.1-.6c.75.7 1.63 1.2 2.6 1.5l.4 2.1h3l.4-2.1a7.4 7.4 0 0 0 2.6-1.5l2.1.6 1.5-2.6Z" />
    </svg>
  );
}

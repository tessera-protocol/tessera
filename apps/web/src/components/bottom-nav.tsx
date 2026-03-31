"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    label: "Passport",
    href: "/",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#7F77DD" : "#55556a"}
        strokeWidth="1.5"
      >
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 10h18" />
        <circle cx="8" cy="15" r="1.5" />
      </svg>
    ),
  },
  {
    label: "Agents",
    href: "/agents",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#7F77DD" : "#55556a"}
        strokeWidth="1.5"
      >
        <path d="M12 2a4 4 0 0 0-4 4v2h8V6a4 4 0 0 0-4-4z" />
        <rect x="3" y="10" width="18" height="12" rx="2" />
        <circle cx="12" cy="16" r="1.5" />
      </svg>
    ),
  },
  {
    label: "Wallet",
    href: "/wallet",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#7F77DD" : "#55556a"}
        strokeWidth="1.5"
      >
        <rect x="2" y="5" width="20" height="15" rx="3" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    ),
  },
  {
    label: "Activity",
    href: "/activity",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#7F77DD" : "#55556a"}
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 border-t border-line bg-surface-base">
      <div className="mx-auto flex max-w-[430px] justify-around py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-1"
            >
              {tab.icon(isActive)}
              <span
                className={`text-[10px] font-sans ${
                  isActive ? "text-brand-purple-light" : "text-content-dim"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

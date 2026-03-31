"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const tabs: Tab[] = [
  {
    href: "/",
    label: "Passport",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
        <rect x="4" y="3.5" width="16" height="17" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    href: "/agents",
    label: "Agents",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
        <path d="M12 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
        <path d="M5 19a7 7 0 0 1 14 0" />
        <path d="M4 10h2M18 10h2M6.5 6.5 8 8M16 8l1.5-1.5" />
      </svg>
    ),
  },
  {
    href: "/wallet",
    label: "Wallet",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h10A2.5 2.5 0 0 1 19 7.5V9H8.5A2.5 2.5 0 0 0 6 11.5v1A2.5 2.5 0 0 0 8.5 15H19v1.5A2.5 2.5 0 0 1 16.5 19h-10A2.5 2.5 0 0 1 4 16.5v-9Z" />
        <path d="M18 9h1.5A1.5 1.5 0 0 1 21 10.5v3a1.5 1.5 0 0 1-1.5 1.5H18a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z" />
      </svg>
    ),
  },
  {
    href: "/activity",
    label: "Activity",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7.5v5l3 2" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 mx-auto mt-auto w-full max-w-md border-t border-[#2a2a3a] bg-[#12121a]/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-medium transition ${
                active
                  ? "bg-[#534AB7]/20 text-[#7F77DD]"
                  : "text-[#8888a0] hover:bg-white/5 hover:text-[#e0e0e8]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

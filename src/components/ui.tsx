"use client";

import { ReactNode } from "react";

export const inputClass =
  "rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-50";
export const checkboxClass = "h-4 w-4 rounded border-neutral-600 bg-neutral-900 accent-blue-600";

const buttonVariants = {
  primary: "bg-blue-600 text-white hover:bg-blue-500 disabled:hover:bg-blue-600",
  neutral: "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 disabled:hover:bg-neutral-800",
  danger: "bg-red-700 text-white hover:bg-red-600 disabled:hover:bg-red-700",
} as const;

export function Button({
  variant = "neutral",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
}) {
  return (
    <button
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

/** Collapsible bordered section. Uses native <details> for accessibility. */
export function Panel({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-900/60 shadow-lg"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium text-neutral-200">
        {title}
        <span className="text-neutral-500 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-neutral-800 px-5 py-4">{children}</div>
    </details>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-neutral-400">
      {label}
      {children}
    </label>
  );
}

export function StatusLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-200 text-right">{value}</span>
    </div>
  );
}

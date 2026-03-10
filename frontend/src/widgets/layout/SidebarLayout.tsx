import React from "react";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  gridClassName?: string;
  className?: string;
}

export function SidebarLayout({
  children,
  sidebar,
  header,
  gridClassName = "items-start",
  className = "",
}: SidebarLayoutProps) {
  return (
    <div className={`max-w-[1400px] mx-auto flex flex-col gap-8 w-full min-h-0 ${className}`}>
      {header && <div>{header}</div>}

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 ${gridClassName}`}>
        <div className="lg:col-span-8 flex flex-col gap-6 min-h-0">{children}</div>

        <aside className="lg:col-span-4 lg:sticky lg:top-24 min-h-0">{sidebar}</aside>
      </div>
    </div>
  );
}

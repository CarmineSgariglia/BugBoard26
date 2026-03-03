interface DetailsLayoutProps {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    header?: React.ReactNode;
}

export function DetailsLayout({ children, sidebar, header }: DetailsLayoutProps) {
    return (
        <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
            {header && <div>{header}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Colonna Sinistra (Main) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {children}
                </div>

                {/* Colonna Destra (Sidebar) */}
                <aside className="lg:col-span-4 lg:sticky lg:top-24">
                    {sidebar}
                </aside>
            </div>
        </div>
    );
}

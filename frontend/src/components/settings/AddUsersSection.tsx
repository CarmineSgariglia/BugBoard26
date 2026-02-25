import { SettingsCard } from "./SettingsCard";

export function AddUsersSection() {
    return (
        <SettingsCard className="w-full flex flex-col items-center justify-center p-14 border-dashed border-2 border-white/20">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/40 mb-4">
                <path d="M16 21V19C16 17.8954 15.1046 17 14 17H5C3.89543 17 3 17.8954 3 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 8V14M17 11H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="text-xl font-bold text-white mb-2">Add New Users</h2>
            <p className="text-center text-sm text-neutral-400">
                This section is still under development.
            </p>
        </SettingsCard>
    );
}

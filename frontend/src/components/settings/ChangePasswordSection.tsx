interface ChangePasswordSectionProps {
    requireCurrentPassword: boolean;
    currentPassword?: string;
    onChangeCurrentPassword?: (val: string) => void;
    newPassword?: string;
    onChangeNewPassword?: (val: string) => void;
    onRetrievePassword: () => void;
}

export function ChangePasswordSection({
    requireCurrentPassword,
    currentPassword = "", onChangeCurrentPassword,
    newPassword = "", onChangeNewPassword,
    onRetrievePassword
}: ChangePasswordSectionProps) {
    const inputClasses = "w-full rounded-lg bg-white/[0.03] border border-white/5 px-4 py-2.5 text-[14px] text-white placeholder-neutral-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all";
    const labelClasses = "block text-[10px] font-bold text-[#8A8F98] uppercase tracking-widest mb-2";

    return (
        <div className="px-8 pb-6 pt-3 relative">
            <h2 className="text-[13px] font-bold text-white mb-5 tracking-wide">Change Password</h2>

            <div className="flex flex-col gap-5">
                {requireCurrentPassword && (
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className={`${labelClasses} mb-0`}>Current Password</label>
                            <button
                                type="button"
                                onClick={onRetrievePassword}
                                className="text-[10px] font-bold uppercase tracking-widest text-[#4A72FF] hover:text-[#678aff] transition-colors focus:outline-none"
                            >
                                RETRIEVE PASSWORD
                            </button>
                        </div>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={e => onChangeCurrentPassword?.(e.target.value)}
                            className={inputClasses}
                            placeholder="••••••••••••"
                        />
                    </div>
                )}

                <div>
                    <label className={labelClasses}>New Password</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={e => onChangeNewPassword?.(e.target.value)}
                        className={inputClasses}
                        placeholder="Enter new password"
                    />
                </div>
            </div>
        </div>
    );
}

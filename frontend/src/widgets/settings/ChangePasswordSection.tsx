import { Input } from "../../shared/ui/Input";

interface ChangePasswordSectionProps {
    requireCurrentPassword: boolean;
    currentPassword?: string;
    onChangeCurrentPassword?: (val: string) => void;
    newPassword?: string;
    onChangeNewPassword?: (val: string) => void;
    onRetrievePassword: () => void;
    error?: string;
}

export function ChangePasswordSection({
    requireCurrentPassword,
    currentPassword = "", onChangeCurrentPassword,
    newPassword = "", onChangeNewPassword,
    onRetrievePassword,
    error
}: ChangePasswordSectionProps) {
    const labelClasses = "block text-[10px] font-bold text-[#8A8F98] uppercase tracking-widest mb-2";

    return (
        <div className="px-8 pb-6 pt-3 relative">
            <h2 className="text-[13px] font-bold text-white mb-5 tracking-wide">Change Password</h2>

            {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-md">
                    {error}
                </div>
            )}

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
                        <Input
                            type="password"
                            value={currentPassword}
                            onChange={e => onChangeCurrentPassword?.(e.target.value)}
                            placeholder="••••••••••••"
                        />
                    </div>
                )}

                <div>
                    <label className={labelClasses}>New Password</label>
                    <Input
                        type="password"
                        value={newPassword}
                        onChange={e => onChangeNewPassword?.(e.target.value)}
                        placeholder="Enter new password"
                    />
                </div>
            </div>
        </div>
    );
}


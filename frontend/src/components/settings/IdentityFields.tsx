interface IdentityFieldsProps {
    name: string;
    onChangeName: (val: string) => void;
    surname: string;
    onChangeSurname: (val: string) => void;
    email: string;
    onChangeEmail: (val: string) => void;
}

export function IdentityFields({
    name, onChangeName,
    surname, onChangeSurname,
    email, onChangeEmail
}: IdentityFieldsProps) {
    const inputClasses = "w-full rounded-lg bg-white/[0.03] border border-white/5 px-4 py-2.5 text-[14px] text-white placeholder-neutral-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all";
    const labelClasses = "block text-[10px] font-bold text-[#8A8F98] uppercase tracking-widest mb-2";

    return (
        <div className="px-8 pb-4 flex flex-col gap-5">
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className={labelClasses}>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => onChangeName(e.target.value)}
                        className={inputClasses}
                        placeholder="First name"
                        spellCheck={false}
                    />
                </div>
                <div className="flex-1">
                    <label className={labelClasses}>Surname</label>
                    <input
                        type="text"
                        value={surname}
                        onChange={e => onChangeSurname(e.target.value)}
                        className={inputClasses}
                        placeholder="Last name"
                        spellCheck={false}
                    />
                </div>
            </div>
            <div>
                <label className={labelClasses}>Email Address</label>
                <input
                    type="email"
                    value={email}
                    onChange={e => onChangeEmail(e.target.value)}
                    className={inputClasses}
                    placeholder="email@example.com"
                    spellCheck={false}
                />
            </div>
        </div>
    );
}

import { TextField } from "../ui/TextField";

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
    const labelClasses = "block text-[10px] font-bold text-[#8A8F98] uppercase tracking-widest mb-2";

    return (
        <div className="px-8 pb-4 flex flex-col gap-5">
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className={labelClasses}>Name</label>
                    <TextField
                        type="text"
                        value={name}
                        onChange={e => onChangeName(e.target.value)}
                        placeholder="First name"
                        spellCheck={false}
                    />
                </div>
                <div className="flex-1">
                    <label className={labelClasses}>Surname</label>
                    <TextField
                        type="text"
                        value={surname}
                        onChange={e => onChangeSurname(e.target.value)}
                        placeholder="Last name"
                        spellCheck={false}
                    />
                </div>
            </div>
            <div>
                <label className={labelClasses}>Email Address</label>
                <TextField
                    type="email"
                    value={email}
                    onChange={e => onChangeEmail(e.target.value)}
                    placeholder="email@example.com"
                    spellCheck={false}
                />
            </div>
        </div>
    );
}

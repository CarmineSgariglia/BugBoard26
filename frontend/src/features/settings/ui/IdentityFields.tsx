import { FormField } from "@shared/ui/FormField";
import { Input } from "@shared/ui/Input";

interface IdentityFieldsProps {
  username?: string;
  onChangeUsername?: (val: string) => void;
  name: string;
  onChangeName: (val: string) => void;
  surname: string;
  onChangeSurname: (val: string) => void;
  email: string;
  onChangeEmail: (val: string) => void;
  errorUsername?: string;
  errorName?: string;
  errorSurname?: string;
  errorEmail?: string;
  className?: string;
}

export function IdentityFields({
  username,
  onChangeUsername,
  name,
  onChangeName,
  surname,
  onChangeSurname,
  email,
  onChangeEmail,
  errorUsername,
  errorName,
  errorSurname,
  errorEmail,
  className = "px-8 pb-4 flex flex-col gap-5",
}: IdentityFieldsProps) {
  return (
    <div className={className}>
      <div className="flex flex-col md:flex-row gap-4">
        <FormField label="Name" className="flex-1" error={errorName}>
          <Input
            type="text"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="First name"
            spellCheck={false}
            hasError={!!errorName}
          />
        </FormField>
        <FormField label="Surname" className="flex-1" error={errorSurname}>
          <Input
            type="text"
            value={surname}
            onChange={(e) => onChangeSurname(e.target.value)}
            placeholder="Last name"
            spellCheck={false}
            hasError={!!errorSurname}
          />
        </FormField>
      </div>
      {typeof username === "string" && onChangeUsername ? (
        <FormField label="Username" error={errorUsername}>
          <Input
            type="text"
            value={username}
            onChange={(e) => onChangeUsername(e.target.value.toLowerCase())}
            placeholder="Username"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            hasError={!!errorUsername}
          />
        </FormField>
      ) : null}
      <FormField label="Email Address" error={errorEmail}>
        <Input
          type="email"
          value={email}
          onChange={(e) => onChangeEmail(e.target.value)}
          placeholder="email@example.com"
          spellCheck={false}
          hasError={!!errorEmail}
        />
      </FormField>
    </div>
  );
}

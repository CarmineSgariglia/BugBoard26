import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { GlassCard } from "@shared/ui/GlassCard";
import { Toggle } from "@shared/ui/Toggle";
import { isValidEmail, isValidName } from "@shared/lib/validation";
import { getErrorMessage } from "@shared/lib/error";
import { FooterActions } from "@shared/ui/FooterActions";
import { createSettingsUserApi } from "@features/settings/api";
import { IdentityFields } from "./IdentityFields";
import { ProfileHeader } from "./ProfileHeader";

function buildUsernameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "user";
  const base = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 20) || "user";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

function generateTemporaryPassword(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `Temp!${suffix}`;
}

type CreateUserFormPayload = {
  normalizedEmail: string;
  username: string;
  temporaryPassword: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
};

export function AddUsersSection() {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const queryClient = useQueryClient();

  const isNameValid = useMemo(() => name === "" || isValidName(name.trim()), [name]);
  const isSurnameValid = useMemo(() => surname === "" || isValidName(surname.trim()), [surname]);
  const isEmailValid = useMemo(() => email === "" || isValidEmail(email.trim()), [email]);

  const isFormValid = useMemo(() => {
    return (
      name.trim().length > 0 &&
      isValidName(name.trim()) &&
      surname.trim().length > 0 &&
      isValidName(surname.trim()) &&
      email.trim().length > 0 &&
      isValidEmail(email.trim())
    );
  }, [name, surname, email]);

  const createUserMutation = useMutation({
    mutationFn: async (payload: CreateUserFormPayload) => {
      await createSettingsUserApi({
        username: payload.username,
        email: payload.normalizedEmail,
        password: payload.temporaryPassword,
        firstName: payload.firstName,
        lastName: payload.lastName,
        isAdmin: payload.isAdmin,
        active: true,
      });
      return payload;
    },
    onSuccess: (payload) => {
      setName("");
      setSurname("");
      setEmail("");
      setIsAdmin(false);
      setSuccess(
        `User created. \n Username: ${payload.username} \n Temporary password: ${payload.temporaryPassword}`
      );
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => {
      setError(getErrorMessage(err, "Unable to create user"));
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isFormValid || createUserMutation.isPending) return;

    setError("");
    setSuccess("");

    const normalizedEmail = email.trim().toLowerCase();
    const username = buildUsernameFromEmail(normalizedEmail);
    const temporaryPassword = generateTemporaryPassword();

    createUserMutation.mutate({
      normalizedEmail,
      username,
      temporaryPassword,
      firstName: name.trim(),
      lastName: surname.trim(),
      isAdmin,
    });
  };

  return (
    <GlassCard className="w-full">
      <ProfileHeader
        title="Add New User"
        subtitle="Enter the details below to create a new account."
        mode="view"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <IdentityFields
          name={name}
          onChangeName={setName}
          surname={surname}
          onChangeSurname={setSurname}
          email={email}
          onChangeEmail={setEmail}
          errorName={!isNameValid ? "Name must contain only letters (min. 3)." : undefined}
          errorSurname={!isSurnameValid ? "Surname must contain only letters (min. 3)." : undefined}
          errorEmail={!isEmailValid ? "Invalid email address." : undefined}
        />

        <div className="h-[1px] w-full bg-white/5"></div>

        <div className="pl-8 pr-8">
          {error ? <p className="text-sm text-red-400 whitespace-pre-line">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-400 whitespace-pre-line">{success}</p> : null}
        </div>

        <div className="flex items-center gap-4 px-8">
          <Toggle checked={isAdmin} onChange={setIsAdmin} label="Make an admin" />
          <span className="text-sm font-bold tracking-wider text-neutral-400 uppercase">Make an Admin</span>
        </div>

        <FooterActions
          isSaveEnabled={isFormValid && !createUserMutation.isPending}
          onSave={() => handleSubmit()}
          isSaving={createUserMutation.isPending}
          saveLabel="Add User"
          links={[]}
        />
      </form>
    </GlassCard>
  );
}

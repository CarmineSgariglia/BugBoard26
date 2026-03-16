import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { RiArrowGoBackLine } from "react-icons/ri";

import { GlassCard } from "../../shared/ui/GlassCard";
import { ProfileHeader } from "./ProfileHeader";
import { IdentityFields } from "./IdentityFields";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { FooterActions } from "../../shared/ui/FooterActions";
import { isValidName, isValidEmail, isValidPassword } from "../../shared/lib/validation";
import { getErrorMessage, getFieldError } from "../../shared/lib/error";
import { resolveMediaUrl } from "../../shared/api/core/media";
import {
  updateUserApi,
  adminChangePasswordApi,
  adminUploadProfileImageApi,
} from "../../shared/api/modules/users";
import type { AuthUser } from "../../shared/api/types/auth";

interface AdminUserEditSectionProps {
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (updatedUser: AuthUser) => void;
}

export function AdminUserEditSection({ user, onClose, onUserUpdated }: AdminUserEditSectionProps) {
  const [username, setUsername] = useState((user.username || "").toLowerCase());
  const [name, setName] = useState(user.firstName || "");
  const [surname, setSurname] = useState(user.lastName || "");
  const [email, setEmail] = useState(user.email || "");

  const [initialData, setInitialData] = useState({
    username: (user.username || "").toLowerCase(),
    name: user.firstName || "",
    surname: user.lastName || "",
    email: user.email || "",
  });

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    user.profileImg ? resolveMediaUrl(user.profileImg) : undefined
  );
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const hasIdentityChanged =
    username !== initialData.username ||
    name !== initialData.name ||
    surname !== initialData.surname ||
    email !== initialData.email;
  const hasPasswordInput = newPassword.length > 0;
  const hasImageChanged = selectedImageFile !== null;
  const isIdentityValid = isValidName(name) && isValidName(surname) && isValidEmail(email);
  const isPasswordValid = !hasPasswordInput || isValidPassword(newPassword);

  const isSaveEnabled =
    (hasIdentityChanged || hasPasswordInput || hasImageChanged) && isIdentityValid && isPasswordValid;

  const handleImageSelect = useCallback((file: File) => {
    setSelectedImageFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let updatedUserObj = { ...user };

      if (selectedImageFile) {
        setIsUploading(true);
        try {
          updatedUserObj = await adminUploadProfileImageApi(user.userId, selectedImageFile);
          if (updatedUserObj.profileImg) {
            setAvatarUrl(resolveMediaUrl(updatedUserObj.profileImg));
          }
          setSelectedImageFile(null);
        } finally {
          setIsUploading(false);
        }
      }

      if (hasIdentityChanged) {
        updatedUserObj = await updateUserApi(user.userId, {
          username: username.trim().toLowerCase(),
          firstName: name.trim(),
          lastName: surname.trim(),
          email: email.trim(),
        });
        setUsername((updatedUserObj.username || "").toLowerCase());
        setName(updatedUserObj.firstName || "");
        setSurname(updatedUserObj.lastName || "");
        setEmail(updatedUserObj.email || "");
        setInitialData({
          username: (updatedUserObj.username || "").toLowerCase(),
          name: updatedUserObj.firstName || "",
          surname: updatedUserObj.lastName || "",
          email: updatedUserObj.email || "",
        });
      }

      if (hasPasswordInput) {
        try {
          await adminChangePasswordApi(user.userId, newPassword);
          setNewPassword("");
        } catch (pwdErr) {
          setPasswordError(getErrorMessage(pwdErr, "Failed to change password."));
        }
      }

      return updatedUserObj;
    },
    onSuccess: (updatedUserObj) => {
      setSuccessMsg("User updated successfully.");
      onUserUpdated(updatedUserObj);
    },
    onError: (err) => {
      console.error("Failed to update user", err);
      const nextUsernameError = getFieldError(err, "username") || "";
      setUsernameError(nextUsernameError);
      setGlobalError(
        nextUsernameError ? "" : getErrorMessage(err, "An error occurred while saving the profile.")
      );
    },
  });

  const handleSave = () => {
    if (saveMutation.isPending || !isSaveEnabled) return;
    setPasswordError("");
    setUsernameError("");
    setGlobalError("");
    setSuccessMsg("");
    saveMutation.mutate();
  };

  return (
    <GlassCard className="w-full">
      <ProfileHeader
        avatarUrl={avatarUrl}
        title={`${user.firstName || user.username} ${user.lastName || ""}'s Profile`}
        subtitle={`Managing user ID: ${user.userId}`}
        onImageSelect={handleImageSelect}
        isUploading={isUploading}
      />

      <IdentityFields
        username={username}
        onChangeUsername={(val) => {
          setUsername(val.toLowerCase());
          if (usernameError) setUsernameError("");
          if (globalError) setGlobalError("");
        }}
        name={name}
        onChangeName={setName}
        surname={surname}
        onChangeSurname={setSurname}
        email={email}
        onChangeEmail={setEmail}
        errorUsername={usernameError || undefined}
      />

      {globalError || successMsg ? (
        <div className="px-8 pb-4">
          {globalError ? <p className="text-sm font-medium text-red-400">{globalError}</p> : null}
          {successMsg ? <p className="text-sm font-medium text-emerald-400">{successMsg}</p> : null}
        </div>
      ) : null}

      <ChangePasswordSection
        requireCurrentPassword={false}
        newPassword={newPassword}
        onChangeNewPassword={(val) => {
          setNewPassword(val);
          if (passwordError) setPasswordError("");
        }}
        onRetrievePassword={() => {}}
        error={passwordError}
      />

      <FooterActions
        isSaveEnabled={isSaveEnabled && !saveMutation.isPending}
        onSave={handleSave}
        isSaving={saveMutation.isPending}
        links={[{ label: "Exit", icon: <RiArrowGoBackLine size={16} />, onClick: onClose }]}
      />
    </GlassCard>
  );
}

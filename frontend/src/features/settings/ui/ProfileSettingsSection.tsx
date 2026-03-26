import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RiArrowGoBackLine } from "react-icons/ri";
import { MdOutlineMail } from "react-icons/md";
import { useToast } from "@shared/providers";

import { GlassCard } from "@shared/ui/GlassCard";
import { FooterActions } from "@shared/ui/FooterActions";
import { InlineFeedbackMessage } from "@shared/ui";
import { isValidName, isValidEmail, isValidPassword } from "@shared/lib/validation";
import { resolveMediaUrl } from "@shared/api/core/media";
import { useAuth } from "@features/auth";
import { getErrorMessage, getFieldError } from "@shared/lib/error";
import { handleGetHelp } from "@shared/lib/help";
import {
  changeSettingsPasswordApi,
  updateSettingsUserApi,
  uploadSettingsProfileImageApi,
} from "@features/settings/api";
import { AvatarCropModal } from "./AvatarCropModal";
import { ProfileHeader } from "./ProfileHeader";
import { IdentityFields } from "./IdentityFields";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { useAvatarCropFlow } from "./useAvatarCropFlow";

export function ProfileSettingsSection({ isAdmin = false }: { isAdmin?: boolean }) {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { pushSuccessToast } = useToast();

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [initialData, setInitialData] = useState({ username: "", name: "", surname: "", email: "" });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const {
    avatarUrl,
    selectedImageFile,
    cropSourceFile,
    cropSourceUrl,
    isCropModalOpen,
    handleImageSelect,
    handleCropConfirm,
    handleCropCancel,
    completeUpload,
  } = useAvatarCropFlow(user?.profileImg ? resolveMediaUrl(user.profileImg) : undefined);

  useEffect(() => {
    if (!user) return;

    setUsername((user.username || "").toLowerCase());
    setName(user.firstName || "");
    setSurname(user.lastName || "");
    setEmail(user.email || "");
    setInitialData({
      username: (user.username || "").toLowerCase(),
      name: user.firstName || "",
      surname: user.lastName || "",
      email: user.email || "",
    });

    completeUpload(user.profileImg ? resolveMediaUrl(user.profileImg) : undefined);
  }, [completeUpload, user]);

  const hasIdentityChanged =
    username !== initialData.username ||
    name !== initialData.name ||
    surname !== initialData.surname ||
    email !== initialData.email;
  const hasPasswordInput = currentPassword.length > 0 || newPassword.length > 0;
  const hasImageChanged = selectedImageFile !== null;

  const isIdentityValid = isValidName(name) && isValidName(surname) && isValidEmail(email);
  const isPasswordValid =
    !hasPasswordInput || (currentPassword.length > 0 && isValidPassword(newPassword));

  const isSaveEnabled =
    (hasIdentityChanged || hasPasswordInput || hasImageChanged) && isIdentityValid && isPasswordValid;

  const handleRetrievePassword = useCallback(() => {
    navigate("/forgot-password");
  }, [navigate]);

  const handleExit = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      let didUpdateIdentity = false;
      let didUploadImage = false;
      let didChangePassword = false;
      let hadPasswordError = false;

      setPasswordError("");
      setIdentityError("");
      setUsernameError("");

      if (selectedImageFile) {
        setIsUploading(true);
        try {
          const updatedUser = await uploadSettingsProfileImageApi(selectedImageFile);
          completeUpload(updatedUser.profileImg ? resolveMediaUrl(updatedUser.profileImg) : undefined);
          didUploadImage = true;
        } finally {
          setIsUploading(false);
        }
      }

      if (hasIdentityChanged) {
        const updated = await updateSettingsUserApi(user.userId, {
          username: username.trim().toLowerCase(),
          firstName: name.trim(),
          lastName: surname.trim(),
          email: email.trim(),
        });

        setUsername((updated.username || "").toLowerCase());
        setName(updated.firstName || "");
        setSurname(updated.lastName || "");
        setEmail(updated.email || "");
        setInitialData({
          username: (updated.username || "").toLowerCase(),
          name: updated.firstName || "",
          surname: updated.lastName || "",
          email: updated.email || "",
        });
        didUpdateIdentity = true;
      }

      if (hasPasswordInput) {
        try {
          await changeSettingsPasswordApi(user.userId, currentPassword, newPassword);
          setCurrentPassword("");
          setNewPassword("");
          didChangePassword = true;
        } catch (pwdErr) {
          hadPasswordError = true;
          setPasswordError(
            getErrorMessage(pwdErr, "Failed to change password. Please check your current password.")
          );
        }
      }

      return {
        didUpdateIdentity,
        didUploadImage,
        didChangePassword,
        hadPasswordError,
      };
    },
    onSuccess: (result) => {
      if (!result || result.hadPasswordError) {
        return;
      }

      if (result.didUpdateIdentity || result.didUploadImage || result.didChangePassword) {
        pushSuccessToast("Profilo modificato con successo.");
      }
    },
    onError: (err) => {
      console.error("Failed to save settings", err);
      const nextUsernameError = getFieldError(err, "username") || "";
      setUsernameError(nextUsernameError);
      setIdentityError(
        nextUsernameError ? "" : getErrorMessage(err, "An error occurred while saving the profile.")
      );
    },
    onSettled: async () => {
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const handleSave = useCallback(() => {
    if (!user || saveMutation.isPending || !isSaveEnabled) return;
    setIdentityError("");
    setUsernameError("");
    setPasswordError("");
    saveMutation.mutate();
  }, [user, saveMutation, isSaveEnabled]);

  return (
    <GlassCard>
      <ProfileHeader
        avatarUrl={avatarUrl}
        title="Profile Settings"
        subtitle="Update your identity and security preferences"
        onImageSelect={handleImageSelect}
        isUploading={isUploading}
        className="text-sm text-neutral-400 text-center max-w-sm mx-auto"
      />

      <AvatarCropModal
        isOpen={isCropModalOpen}
        imageFile={cropSourceFile}
        imageSrc={cropSourceUrl}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />

      <IdentityFields
        username={username}
        onChangeUsername={(val) => {
          setUsername(val.toLowerCase());
          if (usernameError) setUsernameError("");
          if (identityError) setIdentityError("");
        }}
        name={name}
        onChangeName={setName}
        surname={surname}
        onChangeSurname={setSurname}
        email={email}
        onChangeEmail={setEmail}
        errorUsername={usernameError || undefined}
      />

      {identityError ? (
        <div className="px-8 pb-4">
          <InlineFeedbackMessage message={identityError} />
        </div>
      ) : null}

      <ChangePasswordSection
        requireCurrentPassword={true}
        currentPassword={currentPassword}
        onChangeCurrentPassword={(val) => {
          setCurrentPassword(val);
          if (passwordError) setPasswordError("");
        }}
        newPassword={newPassword}
        onChangeNewPassword={(val) => {
          setNewPassword(val);
          if (passwordError) setPasswordError("");
        }}
        onRetrievePassword={handleRetrievePassword}
        error={passwordError}
      />

      <FooterActions
        isSaveEnabled={isSaveEnabled && !saveMutation.isPending}
        onSave={handleSave}
        isSaving={saveMutation.isPending}
        links={[
          ...(!isAdmin ? [{ label: "Exit", icon: <RiArrowGoBackLine size={16} />, onClick: handleExit }] : []),
          ...(!isAdmin
            ? [{ label: "Get Help", icon: <MdOutlineMail size={16} />, onClick: handleGetHelp }]
            : []),
        ]}
      />
    </GlassCard>
  );
}

import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RiArrowGoBackLine } from "react-icons/ri";
import { MdOutlineMail } from "react-icons/md";

import { GlassCard } from "../../shared/ui/GlassCard";
import { ProfileHeader } from "./ProfileHeader";
import { IdentityFields } from "./IdentityFields";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { FooterActions } from "../../shared/ui/FooterActions";
import { isValidName, isValidEmail, isValidPassword } from "../../shared/lib/validation";
import { resolveMediaUrl } from "../../shared/api/core/media";
import {
  uploadProfileImageApi,
  changePasswordApi,
  updateUserApi,
} from "../../shared/api/modules/users";
import { useAuth } from "@shared/providers/AuthContext";
import { getErrorMessage } from "../../shared/lib/error";
import { handleGetHelp } from "../../shared/lib/help";

export function ProfileSettingsSection({ isAdmin = false }: { isAdmin?: boolean }) {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [initialData, setInitialData] = useState({ name: "", surname: "", email: "" });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setName(user.firstName || "");
    setSurname(user.lastName || "");
    setEmail(user.email || "");
    setInitialData({
      name: user.firstName || "",
      surname: user.lastName || "",
      email: user.email || "",
    });

    if (user.profileImg) {
      setAvatarUrl(resolveMediaUrl(user.profileImg));
    }
  }, [user]);

  const hasIdentityChanged =
    name !== initialData.name || surname !== initialData.surname || email !== initialData.email;
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

  const handleImageSelect = useCallback((file: File) => {
    setSelectedImageFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      setPasswordError("");

      if (selectedImageFile) {
        setIsUploading(true);
        try {
          const updatedUser = await uploadProfileImageApi(selectedImageFile);
          if (updatedUser.profileImg) {
            setAvatarUrl(resolveMediaUrl(updatedUser.profileImg));
          }
          setSelectedImageFile(null);
        } finally {
          setIsUploading(false);
        }
      }

      if (hasIdentityChanged) {
        const updated = await updateUserApi(user.userId, {
          firstName: name.trim(),
          lastName: surname.trim(),
          email: email.trim(),
        });

        setName(updated.firstName || "");
        setSurname(updated.lastName || "");
        setEmail(updated.email || "");
        setInitialData({
          name: updated.firstName || "",
          surname: updated.lastName || "",
          email: updated.email || "",
        });
      }

      if (hasPasswordInput) {
        try {
          await changePasswordApi(user.userId, currentPassword, newPassword);
          setCurrentPassword("");
          setNewPassword("");
        } catch (pwdErr) {
          setPasswordError(
            getErrorMessage(pwdErr, "Failed to change password. Please check your current password.")
          );
        }
      }
    },
    onError: (err) => {
      console.error("Failed to save settings", err);
    },
    onSettled: async () => {
      await refreshUser();
    },
  });

  const handleSave = useCallback(() => {
    if (!user || saveMutation.isPending || !isSaveEnabled) return;
    saveMutation.mutate();
  }, [user, saveMutation, isSaveEnabled]);

  return (
    <GlassCard className="w-full">
      <ProfileHeader
        avatarUrl={avatarUrl}
        title="Profile Settings"
        subtitle="Update your identity and security preferences"
        onImageSelect={handleImageSelect}
        isUploading={isUploading}
        className="text-sm text-neutral-400 text-center max-w-sm mx-auto"
      />

      <IdentityFields
        name={name}
        onChangeName={setName}
        surname={surname}
        onChangeSurname={setSurname}
        email={email}
        onChangeEmail={setEmail}
      />

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

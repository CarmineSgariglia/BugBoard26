import { useState, useCallback } from "react";
import { GlassCard } from "../ui/GlassCard";
import { ProfileHeader } from "./ProfileHeader";
import { IdentityFields } from "./IdentityFields";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { RiArrowGoBackLine } from "react-icons/ri";
import { isValidName, isValidEmail, isValidPassword } from "../../utils/validation";
import { getErrorMessage } from "../../utils/error";
import { resolveMediaUrl } from "../../shared/api/core/media";
import { updateUserApi, adminChangePasswordApi, adminUploadProfileImageApi } from "../../shared/api/modules/users";
import type { AuthUser } from "../../shared/api/types/auth";
import { FooterActions } from "../ui/FooterActions";


interface AdminUserEditSectionProps {
    user: AuthUser;
    onClose: () => void;
    onUserUpdated: (updatedUser: AuthUser) => void;
}

export function AdminUserEditSection({ user, onClose, onUserUpdated }: AdminUserEditSectionProps) {
    // Form fields state
    const [name, setName] = useState(user.firstName || "");
    const [surname, setSurname] = useState(user.lastName || "");
    const [email, setEmail] = useState(user.email || "");

    // Store original Data to detect changes
    const [initialData, setInitialData] = useState({
        name: user.firstName || "",
        surname: user.lastName || "",
        email: user.email || ""
    });

    const [newPassword, setNewPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [globalError, setGlobalError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const [isSaving, setIsSaving] = useState(false);

    // Profile header logic
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
        user.profileImg ? resolveMediaUrl(user.profileImg) : undefined
    );
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Validation
    const hasIdentityChanged =
        name !== initialData.name ||
        surname !== initialData.surname ||
        email !== initialData.email;

    const hasPasswordInput = newPassword.length > 0;
    const hasImageChanged = selectedImageFile !== null;
    const isIdentityValid = isValidName(name) && isValidName(surname) && isValidEmail(email);
    const isPasswordValid = !hasPasswordInput || isValidPassword(newPassword);

    // Disable save if nothing changed or fields invalid
    const isSaveEnabled = (hasIdentityChanged || hasPasswordInput || hasImageChanged) && isIdentityValid && isPasswordValid;

    const handleImageSelect = useCallback((file: File) => {
        setSelectedImageFile(file);
        setAvatarUrl(URL.createObjectURL(file));
    }, []);


    const handleSave = async () => {
        if (isSaving || !isSaveEnabled) return;
        setIsSaving(true);
        setPasswordError("");
        setGlobalError("");
        setSuccessMsg("");

        let updatedUserObj = { ...user };
        let hasError = false;

        try {
            // 0. Update Image
            if (selectedImageFile) {
                setIsUploading(true);
                try {
                    updatedUserObj = await adminUploadProfileImageApi(user.userId, selectedImageFile);
                    if (updatedUserObj.profileImg) {
                        setAvatarUrl(resolveMediaUrl(updatedUserObj.profileImg));
                    }
                    setSelectedImageFile(null);
                } catch (imgErr) {
                    hasError = true;
                    setGlobalError(getErrorMessage(imgErr, "Failed to upload the profile image."));
                } finally {
                    setIsUploading(false);
                }
            }

            // 1. Update Identity Data
            if (hasIdentityChanged && !hasError) {
                updatedUserObj = await updateUserApi(user.userId, {
                    firstName: name.trim(),
                    lastName: surname.trim(),
                    email: email.trim(),
                });
                setName(updatedUserObj.firstName || "");
                setSurname(updatedUserObj.lastName || "");
                setEmail(updatedUserObj.email || "");
                setInitialData({
                    name: updatedUserObj.firstName || "",
                    surname: updatedUserObj.lastName || "",
                    email: updatedUserObj.email || "",
                });
            }

            // 2. Update Password
            if (hasPasswordInput && !hasError) {
                try {
                    await adminChangePasswordApi(user.userId, newPassword);
                    setNewPassword("");
                } catch (pwdErr) {
                    hasError = true;
                    setPasswordError(getErrorMessage(pwdErr, "Failed to change password."));
                }
            }
        } catch (err) {
            console.error("Failed to update user", err);
            hasError = true;
            setGlobalError(getErrorMessage(err, "An error occurred while saving the profile."));
        } finally {
            if (!hasError) {
                setSuccessMsg("User updated successfully.");
                onUserUpdated(updatedUserObj);
            }
            setIsSaving(false);
        }
    };

    return (
        <GlassCard className="w-full">
            <ProfileHeader
                avatarUrl={avatarUrl}
                title={`${user.firstName || user.username} ${user.lastName || ''}'s Profile`}
                subtitle={`Managing user ID: ${user.userId}`}
                onImageSelect={handleImageSelect}
                isUploading={isUploading}
            />

            <IdentityFields
                name={name}
                onChangeName={setName}
                surname={surname}
                onChangeSurname={setSurname}
                email={email}
                onChangeEmail={setEmail}
            />

            {(globalError || successMsg) && (
                <div className="px-8 pb-4">
                    {globalError && <p className="text-sm font-medium text-red-400">{globalError}</p>}
                    {successMsg && <p className="text-sm font-medium text-emerald-400">{successMsg}</p>}
                </div>
            )}

            <ChangePasswordSection
                requireCurrentPassword={false}
                newPassword={newPassword}
                onChangeNewPassword={(val) => {
                    setNewPassword(val);
                    if (passwordError) setPasswordError("");
                }}
                onRetrievePassword={() => { }}
                error={passwordError}
            />

            <FooterActions
                isSaveEnabled={isSaveEnabled && !isSaving}
                onSave={handleSave}
                isSaving={isSaving}
                links={[
                    { label: "Exit", icon: <RiArrowGoBackLine size={16} />, onClick: onClose },
                ]}
            />

        </GlassCard>
    );
}

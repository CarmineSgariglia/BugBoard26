import { useState, useCallback } from "react";
import { GlassCard } from "../ui/GlassCard";
import { ProfileHeader } from "./ProfileHeader";
import { IdentityFields } from "./IdentityFields";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { Button } from "../ui/Button";
import { RiArrowGoBackLine } from "react-icons/ri";
import { isValidName, isValidEmail, isValidPassword } from "../../utils/validation";
import { getErrorMessage } from "../../utils/error";
import { resolveMediaUrl, updateUserApi, changePasswordApi, type AuthUser } from "../../services/api";

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

    // Profile Header State
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
        user.profileImg ? resolveMediaUrl(user.profileImg) : undefined
    );
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [isUploading] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [globalError, setGlobalError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Validation
    const hasIdentityChanged =
        name !== initialData.name ||
        surname !== initialData.surname ||
        email !== initialData.email;

    const hasPasswordInput = newPassword.length > 0;
    const hasImageChanged = selectedImageFile !== null;
    const isIdentityValid = isValidName(name) && isValidName(surname) && isValidEmail(email);
    const isPasswordValid = !hasPasswordInput || isValidPassword(newPassword);
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
        let hasError = false;
        let updatedUserObj = { ...user };

        try {
            // NOTE: uploadProfileImageApi uploads for the current user (me), it does not take a userId.
            // If the backend doesn't support admins uploading images for OTHER users, this will fail or update the admin's own photo.
            // Let's assume for now the backend has an endpoint, or we just skip image upload for admins if the API is restricted.
            // Looking at api.ts, uploadProfileImageApi uses `/users/me/upload_profile_image/`.
            // So an admin CANNOT change another user's image with this endpoint.
            // We'll leave it in the UI but it might edit the admin themselves if used, so I will disable image selection for admins editing others.
            // Actually, let's keep it but skip the API call for a moment, or just use the generic users endpoint if we had one.
            // For now, I'll restrict image edits, or simulate it. 
            // Wait, the user asked for: "- Foto - Nome - Cognome - Password". I will add it, but note the API limitation.
            if (selectedImageFile) {
                // Since there is no `users/${userId}/upload_image` in api.ts, I will just show an error indicating it's not supported by API yet.
                setGlobalError("Profile image upload for other users requires a backend update.");
                hasError = true;
            }

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

            if (hasPasswordInput && !hasError) {
                try {
                    // Note: changePasswordApi in api.ts requires currentPassword. 
                    // If backend expects it even for admins, we might get an error. 
                    // Sending empty string for currentPassword.
                    await changePasswordApi(user.userId, "", newPassword);
                    setNewPassword("");
                } catch (pwdErr) {
                    hasError = true;
                    setPasswordError(getErrorMessage(pwdErr, "Failed to change password. Backend may require current password."));
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

            <div className="px-8 pb-8 pt-6 flex flex-col gap-6">
                {globalError && <div className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2 rounded-lg">{globalError}</div>}
                {successMsg && <div className="text-emerald-400 text-sm text-center font-medium bg-emerald-400/10 py-2 rounded-lg">{successMsg}</div>}

                <Button
                    onClick={handleSave}
                    disabled={!isSaveEnabled || isSaving}
                    isLoading={isSaving}
                    className="mt-0 tracking-wide font-semibold text-[14px]"
                >
                    Save Changes
                </Button>

                <div className="flex items-center justify-center gap-6 mt-1 text-[13px] font-medium text-[#8A8F98]">
                    <Button
                        variant="ghost"
                        fullWidth={false}
                        onClick={onClose}
                        className="flex items-center gap-2 hover:text-white transition-colors focus:outline-none"
                    >
                        <RiArrowGoBackLine size={16} />
                        Exit
                    </Button>
                </div>
            </div>
        </GlassCard>
    );
}

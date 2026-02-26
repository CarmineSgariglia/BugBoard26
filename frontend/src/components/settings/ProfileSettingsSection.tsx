import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { GlassCard } from "../ui/GlassCard";
import { ProfileHeader } from "./ProfileHeader";
import { IdentityFields } from "./IdentityFields";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { FooterActions } from "./FooterActions";
import { isValidName, isValidEmail, isValidPassword } from "../../utils/validation";
import { meApi, resolveMediaUrl, uploadProfileImageApi, changePasswordApi, updateUserApi } from "../../services/api";

function getErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    return fallback;
}

export function ProfileSettingsSection({ isAdmin = false }: { isAdmin?: boolean }) {
    const navigate = useNavigate();

    // Form fields state
    const [name, setName] = useState("");
    const [surname, setSurname] = useState("");
    const [email, setEmail] = useState("");

    // Store original API data to detect changes
    const [initialData, setInitialData] = useState({ name: "", surname: "", email: "" });

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");

    // Profile Header State
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [userId, setUserId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Initial load: Pre-fill with current user data
    useEffect(() => {
        meApi().then((user) => {
            if (user) {
                setUserId(user.userId);
                setName(user.firstName || "");
                setSurname(user.lastName || "");
                setEmail(user.email || "");
                setInitialData({
                    name: user.firstName || "",
                    surname: user.lastName || "",
                    email: user.email || ""
                });
                if (user.profileImg) {
                    setAvatarUrl(resolveMediaUrl(user.profileImg));
                }
            }
        }).catch(console.error);
    }, []);

    // Validation
    const hasIdentityChanged =
        name !== initialData.name ||
        surname !== initialData.surname ||
        email !== initialData.email;

    const hasPasswordInput = currentPassword.length > 0 || newPassword.length > 0;
    const hasImageChanged = selectedImageFile !== null;
    const isIdentityValid = isValidName(name) && isValidName(surname) && isValidEmail(email);
    const isPasswordValid = !hasPasswordInput || (currentPassword.length > 0 && isValidPassword(newPassword));
    const isSaveEnabled = (hasIdentityChanged || hasPasswordInput || hasImageChanged) && isIdentityValid && isPasswordValid;

    // Callbacks
    const handleRetrievePassword = useCallback(() => {
        navigate("/forgot-password");
    }, [navigate]);

    const handleExit = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    const handleGetHelp = useCallback(() => {
        window.location.href = "mailto:admin@bugboard.com";
    }, []);

    const handleImageSelect = useCallback((file: File) => {
        setSelectedImageFile(file);
        setAvatarUrl(URL.createObjectURL(file));
    }, []);

    const handleSave = useCallback(async () => {
        if (!userId || isSaving || !isSaveEnabled) return;
        setIsSaving(true);
        setPasswordError(""); // Clear previous errors
        let hasError = false;

        try {
            if (selectedImageFile) {
                setIsUploading(true);
                const updatedUser = await uploadProfileImageApi(selectedImageFile);
                if (updatedUser.profileImg) {
                    setAvatarUrl(resolveMediaUrl(updatedUser.profileImg));
                }
                setSelectedImageFile(null);
                setIsUploading(false);
            }

            if (hasIdentityChanged) {
                const updated = await updateUserApi(userId, {
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
                    await changePasswordApi(userId, currentPassword, newPassword);
                    setCurrentPassword("");
                    setNewPassword("");
                } catch (pwdErr) {
                    hasError = true;
                    setPasswordError(getErrorMessage(pwdErr, "Failed to change password. Please check your current password."));
                }
            }
        } catch (err) {
            console.error("Failed to save settings", err);
            setIsUploading(false);
            hasError = true;
        } finally {
            if (!hasError) {
                // optional success message could go here
            }
            setIsSaving(false);
        }
    }, [
        userId, isSaving, isSaveEnabled, selectedImageFile,
        hasIdentityChanged, name, surname, email,
        hasPasswordInput, currentPassword, newPassword
    ]);

    return (
        <GlassCard className="w-full">
            <ProfileHeader
                avatarUrl={avatarUrl}
                title="Profile Settings"
                subtitle="Update your identity and security preferences"
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
                isSaveEnabled={isSaveEnabled && !isSaving}
                onSave={handleSave}
                onExit={handleExit}
                onGetHelp={handleGetHelp}
                isAdmin={isAdmin}
            />
        </GlassCard>
    );
}

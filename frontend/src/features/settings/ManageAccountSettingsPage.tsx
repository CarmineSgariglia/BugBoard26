import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppBackground } from "../../components/layout/AppBackground";
import { TopNav } from "../../components/navigation/TopNav";
import { SettingsCard } from "../../components/settings/SettingsCard";
import { ProfileHeader } from "../../components/settings/ProfileHeader";
import { IdentityFields } from "../../components/settings/IdentityFields";
import { ChangePasswordSection } from "../../components/settings/ChangePasswordSection";
import { FooterActions } from "../../components/settings/FooterActions";
import { isValidName, isValidEmail, isValidPassword } from "../../utils/validation";
import { meApi, resolveMediaUrl, uploadProfileImageApi, changePasswordApi, updateUserApi } from "../../services/api";

export function ManageAccountSettingsPage() {
    const navigate = useNavigate();

    // Form fields state
    const [name, setName] = useState("");
    const [surname, setSurname] = useState("");
    const [email, setEmail] = useState("");

    // Store original API data to detect changes
    const [initialData, setInitialData] = useState({ name: "", surname: "", email: "" });

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

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

    // Validation (as per technical requirement)
    // The button is disabled by default and enabled ONLY if all 3 validate correctly.

    // Check if identity fields were modified from original data
    const hasIdentityChanged =
        name !== initialData.name ||
        surname !== initialData.surname ||
        email !== initialData.email;

    // Check if user is trying to change password
    const hasPasswordInput = currentPassword.length > 0 || newPassword.length > 0;

    // Check if an image was selected
    const hasImageChanged = selectedImageFile !== null;

    // Check if the current visible inputs are formally valid
    const isIdentityValid = isValidName(name) && isValidName(surname) && isValidEmail(email);
    const isPasswordValid = !hasPasswordInput || (currentPassword.length > 0 && isValidPassword(newPassword));

    // Button is enabled ONLY if at least one section has changed, AND everything that was entered is valid
    const isSaveEnabled = (hasIdentityChanged || hasPasswordInput || hasImageChanged) && isIdentityValid && isPasswordValid;

    // Callbacks. React.memo wasn't abused on child elements, but using useCallback for clarity.
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
        // Create a local blob URL for instant preview without uploading
        setAvatarUrl(URL.createObjectURL(file));
    }, []);

    const handleSave = useCallback(async () => {
        if (!userId || isSaving || !isSaveEnabled) return;
        setIsSaving(true);
        try {
            // 1. Upload Profile Image if changed
            if (selectedImageFile) {
                setIsUploading(true);
                const updatedUser = await uploadProfileImageApi(selectedImageFile);
                if (updatedUser.profileImg) {
                    setAvatarUrl(resolveMediaUrl(updatedUser.profileImg));
                }
                setSelectedImageFile(null); // Reset after upload
                setIsUploading(false);
            }

            // 2. Update Identity Info if changed
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

            // 3. Update Password if attempted
            if (hasPasswordInput) {
                await changePasswordApi(userId, currentPassword, newPassword);
                setCurrentPassword("");
                setNewPassword("");
            }
        } catch (err) {
            console.error("Failed to save settings", err);
            setIsUploading(false);
        } finally {
            setIsSaving(false);
        }
    }, [
        userId,
        isSaving,
        isSaveEnabled,
        selectedImageFile,
        hasIdentityChanged,
        name,
        surname,
        email,
        hasPasswordInput,
        currentPassword,
        newPassword
    ]);

    return (
        <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col relative overflow-hidden">
            <AppBackground />

            {/* Top Navigation remains part of the app wrapper logic */}
            <TopNav />

            {/* Centered Main Content */}
            <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-10 relative z-10 flex flex-col items-center justify-center">
                <SettingsCard>
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
                        onChangeCurrentPassword={setCurrentPassword}
                        newPassword={newPassword}
                        onChangeNewPassword={setNewPassword}
                        onRetrievePassword={handleRetrievePassword}
                    />

                    <FooterActions
                        isSaveEnabled={isSaveEnabled && !isSaving}
                        onSave={handleSave}
                        onExit={handleExit}
                        onGetHelp={handleGetHelp}
                    />
                </SettingsCard>
            </div>
        </div>
    );
}

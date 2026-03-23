import { useCallback, useEffect, useRef, useState } from "react";

function revokeObjectUrl(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function useAvatarCropFlow(initialAvatarUrl?: string) {
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(initialAvatarUrl);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);
  const cropObjectUrlRef = useRef<string | null>(null);

  const updateAvatarPreview = useCallback((nextAvatarUrl?: string) => {
    revokeObjectUrl(avatarObjectUrlRef.current);
    avatarObjectUrlRef.current = null;
    setAvatarUrl(nextAvatarUrl);
  }, []);

  const setAvatarPreviewFromFile = useCallback((file: File) => {
    revokeObjectUrl(avatarObjectUrlRef.current);
    const nextObjectUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = nextObjectUrl;
    setAvatarUrl(nextObjectUrl);
  }, []);

  const clearCropSource = useCallback(() => {
    revokeObjectUrl(cropObjectUrlRef.current);
    cropObjectUrlRef.current = null;
    setCropSourceFile(null);
    setCropSourceUrl(null);
  }, []);

  const handleImageSelect = useCallback(
    (file: File) => {
      clearCropSource();
      const nextObjectUrl = URL.createObjectURL(file);
      cropObjectUrlRef.current = nextObjectUrl;
      setCropSourceFile(file);
      setCropSourceUrl(nextObjectUrl);
    },
    [clearCropSource],
  );

  const handleCropConfirm = useCallback(
    (file: File) => {
      setSelectedImageFile(file);
      setAvatarPreviewFromFile(file);
      clearCropSource();
    },
    [clearCropSource, setAvatarPreviewFromFile],
  );

  const handleCropCancel = useCallback(() => {
    clearCropSource();
  }, [clearCropSource]);

  const completeUpload = useCallback(
    (nextAvatarUrl?: string) => {
      setSelectedImageFile(null);
      updateAvatarPreview(nextAvatarUrl);
    },
    [updateAvatarPreview],
  );

  useEffect(() => {
    if (initialAvatarUrl === undefined) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      updateAvatarPreview(initialAvatarUrl);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialAvatarUrl, updateAvatarPreview]);

  useEffect(() => () => {
    revokeObjectUrl(avatarObjectUrlRef.current);
    revokeObjectUrl(cropObjectUrlRef.current);
  }, []);

  return {
    avatarUrl,
    selectedImageFile,
    cropSourceFile,
    cropSourceUrl,
    isCropModalOpen: Boolean(cropSourceFile && cropSourceUrl),
    handleImageSelect,
    handleCropConfirm,
    handleCropCancel,
    completeUpload,
  };
}

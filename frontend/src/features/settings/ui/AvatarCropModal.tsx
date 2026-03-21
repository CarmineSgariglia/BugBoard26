import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import { cropProfileImage } from "@shared/lib/media";
import { Button } from "@shared/ui/Button";
import { GlassCard } from "@shared/ui/GlassCard";
import { ModalOverlay } from "@widgets/layout/ModalOverlay";

interface AvatarCropModalProps {
  isOpen: boolean;
  imageFile: File | null;
  imageSrc: string | null;
  onConfirm: (croppedFile: File) => void | Promise<void>;
  onCancel: () => void;
}

export function AvatarCropModal({
  isOpen,
  imageFile,
  imageSrc,
  onConfirm,
  onCancel,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleClose = useCallback(() => {
    if (isProcessing) {
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    onCancel();
  }, [isProcessing, onCancel]);

  const handleConfirm = useCallback(async () => {
    if (!imageFile || !imageSrc || !croppedAreaPixels || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      const croppedFile = await cropProfileImage(imageFile, imageSrc, croppedAreaPixels, rotation);
      await onConfirm(croppedFile);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imageFile, imageSrc, isProcessing, onConfirm, rotation]);

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} maxWidth="max-w-3xl">
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Adjust profile picture</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Drag the image to reframe it, then use zoom and rotation to refine the avatar crop.
            </p>
          </div>

          <div className="relative h-[320px] overflow-hidden rounded-3xl border border-white/10 bg-black/40 sm:h-[420px]">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={handleCropComplete}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
              />
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-neutral-300" htmlFor="avatar-crop-zoom">
              Zoom
              <input
                id="avatar-crop-zoom"
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="accent-white"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-neutral-300" htmlFor="avatar-crop-rotation">
              Rotation
              <input
                id="avatar-crop-rotation"
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(event) => setRotation(Number(event.target.value))}
                className="accent-white"
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              fullWidth={false}
              onClick={handleClose}
              disabled={isProcessing}
              className="px-5"
            >
              Cancel
            </Button>
            <Button
              fullWidth={false}
              onClick={handleConfirm}
              isLoading={isProcessing}
              disabled={!imageFile || !imageSrc || !croppedAreaPixels}
              className="px-5"
            >
              Apply crop
            </Button>
          </div>
        </div>
      </GlassCard>
    </ModalOverlay>
  );
}

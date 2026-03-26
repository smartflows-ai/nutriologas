"use client";

import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "@/lib/image/crop";
import { cropToBlob } from "@/lib/image/crop";

export default function ImageCropperModal(props: {
  file: File;
  title: string;
  aspect: number;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}) {
  const { file, title, aspect, onCancel, onConfirm } = props;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Leer el archivo como data URL para evitar problemas con blob URLs
  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled) setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

  const confirm = async () => {
    setSaving(true);
    try {
      if (!croppedAreaPixels || !imageSrc) {
        // Fallback: si algo falla con el crop o la imagen, usar el archivo original
        onConfirm(file);
        return;
      }
      const blob = await cropToBlob(imageSrc, croppedAreaPixels, "image/jpeg", 0.92);
      const croppedFile = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      onConfirm(croppedFile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-900 dark:text-white">
            Cerrar
          </button>
        </div>

        <div className="relative w-full h-[420px] bg-black">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels as Area)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              Cargando imagen...
            </div>
          )}
        </div>

        <div className="p-5 border-t flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancelar
          </button>
          <button type="button" onClick={confirm} disabled={saving} className="btn-primary">
            {saving ? "Guardando..." : "Usar imagen"}
          </button>
        </div>
      </div>
    </div>
  );
}


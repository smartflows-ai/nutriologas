"use client";
// src/app/admin/carrusel/page.tsx
import { useState, useEffect } from "react";
import { Trash2, Plus, GripVertical, ImageIcon } from "lucide-react";
import Image from "next/image";
import ImageCropperModal from "@/components/admin/ImageCropperModal";

interface CarouselImage { id: string; url: string; alt: string | null; sortOrder: number; }

export default function CarruselPage() {
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newAlt, setNewAlt] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const fetchImages = async () => {
    const res = await fetch(`/api/carousel?t=${Date.now()}`);
    setImages(await res.json());
  };

  useEffect(() => { fetchImages(); }, []);

  const uploadFromComputer = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", "carousel");
      const res = await fetch("/api/upload/cloudinary", { method: "POST", body: form });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(data?.error ?? "Error subiendo imagen");
      setNewUrl(data.url);
    } catch (e: any) {
      setUploadError(e?.message ?? "Error subiendo imagen");
    } finally {
      setUploading(false);
    }
  };

  const addImage = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim(), alt: newAlt.trim() || null }),
      });
      const newImg = await res.json();
      if (res.ok) {
        // Actualizamos estado de forma optimista para evitar el caché de Next.js
        setImages((prev) => [...prev, newImg]);
      }
    } finally {
      setNewUrl("");
      setNewAlt("");
      setAdding(false);
      fetchImages();
    }
  };

  const deleteImage = async (id: string) => {
    if (!confirm("¿Eliminar esta imagen del carrusel?")) return;
    await fetch(`/api/carousel/${id}`, { method: "DELETE" });
    fetchImages();
  };

  // Drag & drop reorder
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;
    const from = images.findIndex((i) => i.id === dragging);
    const to = images.findIndex((i) => i.id === targetId);
    const reordered = [...images];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setImages(reordered);
  };
  const handleDrop = async () => {
    setDragging(null);
    await fetch("/api/carousel", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: images.map((img, i) => ({ id: img.id, sortOrder: i })) }),
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Carrusel</h1>
      <p className="text-gray-500 text-sm mb-8">Administra las imágenes del banner principal de tu tienda</p>

      {/* Add new image */}
      <div className="card mb-8">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus size={18} className="text-primary" /> Agregar imagen
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <label className="btn-ghost cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPendingFile(f);
                e.currentTarget.value = "";
              }}
              disabled={uploading}
            />
            {uploading ? "Subiendo..." : "Subir desde tu computadora"}
          </label>
          <span className="text-xs text-gray-400">o pega una URL</span>
        </div>
        {uploadError && <p className="text-red-500 text-xs mb-3">{uploadError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">URL de la imagen *</label>
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="input"
              placeholder="https://res.cloudinary.com/... o cualquier URL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Texto alternativo</label>
            <input
              value={newAlt}
              onChange={(e) => setNewAlt(e.target.value)}
              className="input"
              placeholder="ej: Banner principal"
            />
          </div>
        </div>
        {newUrl && (
          <div className="relative h-32 rounded-xl overflow-hidden bg-gray-100 mb-4">
            <Image src={newUrl} alt="Preview" fill sizes="(max-width: 768px) 100vw, 384px" className="object-cover" onError={() => { }} />
          </div>
        )}
        <button onClick={addImage} disabled={!newUrl.trim() || adding} className="btn-primary flex items-center gap-2">
          <ImageIcon size={16} /> {adding ? "Agregando..." : "Agregar al carrusel"}
        </button>
      </div>

      {/* Images list */}
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
          Imágenes actuales ({images.length})
          <span className="text-xs text-gray-400 font-normal ml-2">Arrastra para reordenar</span>
        </h2>

        {images.length === 0 ? (
          <div className="card text-center py-10 text-gray-400">
            <ImageIcon size={40} className="mx-auto mb-3 opacity-40" />
            <p>No hay imágenes en el carrusel aún.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {images.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(img.id)}
                onDragOver={(e) => handleDragOver(e, img.id)}
                onDrop={handleDrop}
                className={`card flex items-center gap-4 p-3 cursor-grab active:cursor-grabbing transition-all ${dragging === img.id ? "opacity-50 scale-95" : ""}`}
              >
                <GripVertical size={18} className="text-gray-300 flex-shrink-0" />
                <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-center">{index + 1}</span>
                <div className="relative w-24 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src={img.url} alt={img.alt ?? ""} fill sizes="96px" className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{img.alt ?? "Sin texto alternativo"}</p>
                  <p className="text-xs text-gray-400 truncate">{img.url}</p>
                </div>
                <button
                  onClick={() => deleteImage(img.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingFile && (
        <ImageCropperModal
          file={pendingFile}
          title="Ajustar imagen del carrusel"
          aspect={1200 / 500}
          onCancel={() => setPendingFile(null)}
          onConfirm={(cropped) => {
            setPendingFile(null);
            uploadFromComputer(cropped);
          }}
        />
      )}
    </div>
  );
}

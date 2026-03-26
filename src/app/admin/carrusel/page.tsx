"use client";
// src/app/admin/carrusel/page.tsx
import { useState, useEffect } from "react";
import { Trash2, Plus, GripVertical, ImageIcon, UploadCloud, X, Check } from "lucide-react";
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
  const [showAddForm, setShowAddForm] = useState(false);

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
        setImages((prev) => [...prev, newImg]);
        setShowAddForm(false);
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
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Carrusel</h1>
          <p className="text-gray-500 text-sm">Gestiona el escaparate principal de tu tienda con banners impactantes.</p>
        </div>
        {!showAddForm && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> Nuevo Banner
          </button>
        )}
      </div>

      {/* Agregar nueva imagen */}
      {showAddForm && (
        <div className="card mb-10 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus size={18} className="text-primary" />
              </div> 
              Añadir imagen al carrusel
            </h2>
            <button 
              onClick={() => setShowAddForm(false)}
              className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
             {/* Left: Dropzone */}
             <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Archivo de Imagen
                </label>
                
                <label className={`aspect-[12/5] flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all group overflow-hidden relative ${
                  uploading 
                    ? "border-primary/40 bg-primary/5 cursor-wait" 
                    : "border-gray-200 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5 shadow-sm"
                }`}>
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
                  
                  {newUrl ? (
                    <>
                      <img src={newUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-xs font-bold flex items-center gap-2 px-3 py-1.5 bg-black/50 rounded-full border border-white/20">
                           <UploadCloud size={14} /> Reemplazar imagen
                        </div>
                      </div>
                    </>
                  ) : uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold text-primary animate-pulse">Subiendo imagen...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <UploadCloud size={24} className="text-gray-400 group-hover:text-primary" />
                      </div>
                      <span className="text-sm font-bold text-gray-500 group-hover:text-primary">Click para subir banner</span>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">1200 x 500 px recomendado</p>
                    </>
                  )}
                </label>
                
                {uploadError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 flex items-center gap-2">
                    <X size={14} className="text-red-500" />
                    <span className="text-xs text-red-600 font-medium">{uploadError}</span>
                  </div>
                )}
             </div>

             {/* Right: Metadata */}
             <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">URL del Banner (Opcional)</label>
                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="input bg-white dark:bg-gray-900 border-gray-200 transition-all font-mono text-xs"
                    placeholder="https://..."
                  />
                  <p className="text-[10px] text-gray-400">Si lo subes arriba la URL se autocompletará.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Texto Alternativo (Alt)</label>
                  <input
                    value={newAlt}
                    onChange={(e) => setNewAlt(e.target.value)}
                    className="input bg-white dark:bg-gray-900 border-gray-200 transition-all"
                    placeholder="Ej: Promo de Suplementos Primavera"
                  />
                  <p className="text-[10px] text-gray-400">Ayuda al SEO y accesibilidad.</p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={addImage} 
                    disabled={!newUrl.trim() || adding} 
                    className="btn-primary flex-1 h-12 flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary/20"
                  >
                    {adding ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : <Check size={18} />}
                    {adding ? "Agregando..." : "Confirmar y Publicar"}
                  </button>
                  <button 
                    onClick={() => setShowAddForm(false)}
                    className="btn-ghost flex-1 h-12 text-gray-500 font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Images list */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <ImageIcon size={18} className="text-gray-500" />
            </div>
            Banners Actuales ({images.length})
          </h2>
          {images.length > 0 && (
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              Arrastra para reordenar
            </span>
          )}
        </div>

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
                <div className="relative w-32 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 ring-4 ring-white shadow-sm">
                  <Image src={img.url} alt={img.alt ?? ""} fill sizes="128px" className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{img.alt ?? "Banner sin descripción"}</p>
                  <p className="text-[10px] text-gray-400 truncate font-mono mt-0.5">{img.url}</p>
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
    </>
  );
}

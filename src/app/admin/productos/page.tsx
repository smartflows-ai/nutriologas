"use client";
// src/app/admin/productos/page.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductInput } from "@/lib/validations";
import { formatPrice } from "@/lib/utils";
import { Plus, Pencil, Trash2, X, Check, Package } from "lucide-react";
import ImageCropperModal from "@/components/admin/ImageCropperModal";

interface Product { id: string; name: string; price: number; stock: number; category: string | null; isActive: boolean; images: string[]; description: string | null; }

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductInput>({ resolver: zodResolver(productSchema) });

  const fetchProducts = async () => {
    const res = await fetch(`/api/products?t=${Date.now()}`);
    setProducts(await res.json());
  };

  useEffect(() => { fetchProducts(); }, []);

  const openCreate = () => {
    setEditing(null);
    setImages([]);
    setUploadError("");
    reset({ isActive: true, stock: 0, images: [] });
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    reset({ name: p.name, description: p.description ?? "", price: p.price, stock: p.stock, category: p.category ?? "", isActive: p.isActive, images: p.images });
    setImages(p.images ?? []);
    setUploadError("");
    setOpen(true);
  };

  const uploadFromComputer = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", "products");
      const res = await fetch("/api/upload/cloudinary", { method: "POST", body: form });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(data?.error ?? "Error subiendo imagen");
      setImages((prev) => [...prev, data.url]);
    } catch (e: any) {
      setUploadError(e?.message ?? "Error subiendo imagen");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: ProductInput) => {
    setLoading(true);
    const url = editing ? `/api/products/${editing.id}` : "/api/products";
    const method = editing ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, images }) });
    setOpen(false);
    setLoading(false);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="text-gray-500 text-sm">{products.length} productos en total</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nuevo producto</button>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {products.map((p) => (
          <div key={p.id} className="card flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              {p.images[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover rounded-xl" /> : <Package size={20} className="text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{p.name}</p>
              <p className="text-primary font-bold text-sm">{formatPrice(p.price)}</p>
              <div className="flex gap-2 mt-1">
                <span className={`badge text-xs ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.isActive ? "Activo" : "Inactivo"}</span>
                <span className={`badge text-xs ${p.stock <= 5 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700 dark:text-gray-200"}`}>Stock: {p.stock}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary"><Pencil size={16} /></button>
              <button onClick={() => deleteProduct(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">Sin productos. Crea el primero.</p>}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200">
            <tr>
              {["Producto", "Precio", "Stock", "Categoría", "Estado", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:bg-gray-950 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {p.images[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover rounded-lg" /> : <Package size={18} className="text-gray-400" />}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-primary">{formatPrice(p.price)}</td>
                <td className="px-4 py-3"><span className={`badge ${p.stock <= 5 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700 dark:text-gray-200"}`}>{p.stock}</span></td>
                <td className="px-4 py-3 text-gray-500">{p.category ?? "—"}</td>
                <td className="px-4 py-3"><span className={`badge ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.isActive ? "Activo" : "Inactivo"}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors"><Pencil size={16} /></button>
                    <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (<tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin productos. Crea el primero.</td></tr>)}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-bold text-lg">{editing ? "Editar producto" : "Nuevo producto"}</h2>
              <button onClick={() => setOpen(false)}><X size={22} /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Fotos</label>
                <div className="flex items-center gap-3">
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
                    {uploading ? "Subiendo..." : "Subir foto"}
                  </label>
                  <span className="text-xs text-gray-400">Puedes subir varias</span>
                </div>

                {uploadError && <p className="text-red-500 text-xs mt-2">{uploadError}</p>}

                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {images.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="relative group">
                        <img src={url} alt="" className="w-full h-16 object-cover rounded-lg border border-gray-100" />
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white dark:bg-gray-900 shadow border border-gray-200 text-gray-500 hover:text-red-500 flex items-center justify-center"
                          aria-label="Quitar imagen"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nombre *</label>
                <input {...register("name")} className="input" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Descripción</label>
                <textarea {...register("description")} rows={3} className="input resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Precio (MXN) *</label>
                  <input {...register("price", { valueAsNumber: true })} type="number" step="0.01" className="input" />
                  {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Stock</label>
                  <input {...register("stock", { valueAsNumber: true })} type="number" className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Categoría</label>
                <input {...register("category")} className="input" placeholder="ej: Servicios, Planes, Suplementos" />
              </div>
              <div className="flex items-center gap-3">
                <input {...register("isActive")} type="checkbox" id="isActive" className="w-4 h-4 accent-primary" />
                <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-200">Producto activo (visible en tienda)</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Check size={16} />{loading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingFile && (
        <ImageCropperModal
          file={pendingFile}
          title="Ajustar foto del producto"
          aspect={1}
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

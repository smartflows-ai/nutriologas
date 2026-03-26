"use client";
// src/app/admin/productos/page.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductInput } from "@/lib/validations";
import { formatPrice } from "@/lib/utils";
import { Plus, Pencil, Trash2, X, Check, Package, UploadCloud, ImageIcon } from "lucide-react";
import ImageCropperModal from "@/components/admin/ImageCropperModal";
import Pagination from "@/components/admin/Pagination";

interface Product { id: string; name: string; price: number; stock: number; category: string | null; isActive: boolean; images: string[]; description: string | null; }

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductInput>({ resolver: zodResolver(productSchema) });

  const fetchProducts = async (pageNumber = 1) => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`/api/products?page=${pageNumber}&limit=10&t=${Date.now()}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount || 0);
    } catch (e) {
      console.error("Error fetching products:", e);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => { fetchProducts(page); }, [page]);

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
    fetchProducts(page);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts(page);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="text-gray-500 text-sm">{totalCount} productos en total</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nuevo producto</button>
      </div>

      {loadingProducts ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 animate-pulse">Cargando productos...</p>
        </div>
      ) : (
        <>
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
                  <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors"><Pencil size={16} /></button>
                  <button onClick={() => deleteProduct(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">Sin productos. Crea el primero.</p>}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  {["Producto", "Precio", "Stock", "Categoría", "Estado", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                          {p.images[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover rounded-lg" /> : <Package size={18} className="text-gray-400 dark:text-gray-500" />}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3"><span className={`badge ${p.stock <= 5 ? "bg-red-100 text-red-700" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>{p.stock}</span></td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category ?? "—"}</td>
                    <td className="px-4 py-3"><span className={`badge ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>{p.isActive ? "Activo" : "Inactivo"}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-primary transition-colors"><Pencil size={16} /></button>
                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (<tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin productos. Crea el primero.</td></tr>)}
              </tbody>
            </table>
          </div>

          <Pagination 
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h2 className="font-bold text-xl text-gray-900 dark:text-white">{editing ? "Editar producto" : "Nuevo producto"}</h2>
                <p className="text-xs text-gray-500 mt-1">Completa la información detallada del producto.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><X size={22} /></button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Columna Izquierda: Imágenes y Multimedia */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                    <ImageIcon size={16} className="text-primary" /> Imágenes del Producto
                  </label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {images.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="relative aspect-square group rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shadow-sm">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
                            aria-label="Quitar imagen"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {images.length < 6 && (
                      <label className={`aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all group ${
                        uploading 
                          ? "border-primary/40 bg-primary/5 cursor-wait" 
                          : "border-gray-200 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5 hover:shadow-inner"
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
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-medium text-primary animate-pulse">Subiendo...</span>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                              <UploadCloud size={20} className="text-gray-400 group-hover:text-primary" />
                            </div>
                            <span className="text-xs font-semibold text-gray-500 group-hover:text-primary">Añadir foto</span>
                          </>
                        )}
                      </label>
                    )}
                  </div>
                  
                  {uploadError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                       <X size={14} className="text-red-500" />
                       <p className="text-red-600 dark:text-red-400 text-xs font-medium">{uploadError}</p>
                    </div>
                  )}
                  
                  <p className="text-[10px] text-gray-400 italic">
                    Tip: Sube imágenes cuadradas (1:1) de alta calidad para lucir mejor en la tienda.
                  </p>
                </div>

                {/* Columna Derecha: Detalles Base */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Nombre del Producto</label>
                    <input {...register("name")} className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:bg-white transition-all" placeholder="Ej: Whey Protein 1kg" />
                    {errors.name && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Descripción</label>
                    <textarea {...register("description")} rows={4} className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:bg-white transition-all resize-none text-sm" placeholder="Describe los beneficios y características..." />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Precio (MXN)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input {...register("price", { valueAsNumber: true })} type="number" step="0.01" className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 pl-7" placeholder="0.00" />
                      </div>
                      {errors.price && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.price.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Stock</label>
                      <input {...register("stock", { valueAsNumber: true })} type="number" className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800" placeholder="Cant." />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Categoría</label>
                    <input {...register("category")} className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800" placeholder="ej: Suplementos, Planes, etc." />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 select-none cursor-pointer" onClick={() => (document.getElementById('isActive') as HTMLInputElement).click()}>
                    <input {...register("isActive")} type="checkbox" id="isActive" className="w-5 h-5 accent-primary rounded-md cursor-pointer" />
                    <div>
                      <label htmlFor="isActive" className="text-sm font-semibold text-gray-900 dark:text-gray-200 block cursor-pointer">Producto visible</label>
                      <p className="text-[10px] text-gray-500">¿Debería aparecer en la tienda pública?</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 py-3 font-semibold text-gray-600">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary flex-[2] py-3 flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary/20">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={18} />
                      {editing ? "Actualizar Producto" : "Crear Producto"}
                    </>
                  )}
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

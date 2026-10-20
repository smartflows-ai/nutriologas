"use client";
// src/app/admin/productos/page.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductInput } from "@/lib/validations";
import { translateValidation } from "@/i18n/validation";
import { formatPrice, localeFor, fill } from "@/lib/utils";
import { getProductFormProfile, type ProductFormType } from "@/lib/product-form-profiles";
import { Plus, Pencil, Trash2, X, Check, Package, UploadCloud, ImageIcon, Calendar, Clock } from "lucide-react";
import ImageCropperModal from "@/components/admin/ImageCropperModal";
import FormPanel from "@/components/admin/FormPanel";
import Pagination from "@/components/admin/Pagination";
import { useTenantMeta } from "@/components/admin/TenantMeta";
import { useTranslation } from "@/i18n";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string | null;
  isActive: boolean;
  images: string[];
  description: string | null;
  itemType?: "PHYSICAL" | "SERVICE" | "PACKAGE" | "SUBSCRIPTION";
  durationMinutes?: number | null;
  requiresBooking?: boolean;
  capacity?: number | null;
}

// Empty optional number inputs become null instead of NaN, so they pass validation.
const toNumberOrNull = (value: unknown) => (value === "" || value == null || Number.isNaN(Number(value)) ? null : Number(value));

export default function ProductosPage() {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);
  const { vertical, isBookingEnabled } = useTenantMeta();
  const profile = getProductFormProfile(vertical, isBookingEnabled);
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

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      itemType: "PHYSICAL",
      stock: 0,
      isActive: true,
      requiresBooking: false,
      images: [],
    }
  });

  const selectedItemType = (watch("itemType") || "PHYSICAL") as ProductFormType;
  // Offer the profile's types, plus the saved type if it falls outside them (e.g. an older service in a store with booking off).
  const typeOptions: ProductFormType[] = profile.types.includes(selectedItemType) ? profile.types : [...profile.types, selectedItemType];

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
    reset({
      name: "",
      description: "",
      price: 0,
      stock: 0,
      category: "",
      isActive: true,
      images: [],
      itemType: profile.defaultType,
      durationMinutes: null,
      capacity: null,
      requiresBooking: profile.defaultType === "SERVICE" && isBookingEnabled,
    });
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    reset({
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      stock: p.stock,
      category: p.category ?? "",
      isActive: p.isActive,
      images: p.images,
      itemType: p.itemType ?? "PHYSICAL",
      durationMinutes: p.durationMinutes ?? null,
      capacity: p.capacity ?? null,
      requiresBooking: p.requiresBooking ?? false,
    });
    setImages(p.images ?? []);
    setUploadError("");
    setOpen(true);
  };

  // Switching type resets the fields that do not apply to it.
  const selectType = (type: ProductFormType) => {
    setValue("itemType", type);
    setValue("requiresBooking", type === "SERVICE" && isBookingEnabled);
    if (type === "SERVICE") {
      setValue("stock", 0);
    } else {
      setValue("durationMinutes", null);
      setValue("capacity", null);
    }
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
      if (!res.ok) throw new Error(data?.error ?? t.productsAdmin.uploadError);
      setImages((prev) => [...prev, data.url]);
    } catch (e: any) {
      setUploadError(e?.message ?? t.productsAdmin.uploadError);
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
    if (!confirm(t.crm.products.modal.deleteConfirm)) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts(page);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Package className="text-primary" size={26} />
            {t.crm.products.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t.crm.products.subtitle} • {totalCount} {t.crm.products.totalProducts}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 shadow-sm">
          <Plus size={18} /> {t.crm.products.newProduct}
        </button>
      </div>

      {/* Add / edit modal */}
      {open && (
        <FormPanel
          icon={<Package size={18} className="text-primary" />}
          title={editing ? t.crm.products.modal.editTitle : t.crm.products.modal.newTitle}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Selector de tipo: solo los tipos que el giro del negocio usa */}
            {typeOptions.length > 1 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-800">
                <label className="block text-xs font-semibold text-gray-500 mb-2">{t.productsAdmin.typeLabel}</label>
                <div className="grid grid-cols-2 gap-3">
                  {typeOptions.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectType(type)}
                      className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                        selectedItemType === type
                          ? "bg-primary text-white "
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {type === "SERVICE" ? <Clock size={16} /> : <Package size={16} />}
                      {type === "SERVICE" ? t.productsAdmin.service : t.productsAdmin.physical}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Columna Izquierda: Imágenes y Multimedia */}
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                  <ImageIcon size={16} className="text-primary" /> {t.crm.products.modal.imagesTitle}
                </label>

                <div className="grid grid-cols-2 gap-4">
                  {images.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative aspect-square group rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shadow-sm">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center transition-all "
                          aria-label={t.crm.products.modal.removePhoto}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {images.length < 6 && (
                    <label className={`aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all group ${
                      uploading
                        ? "border-primary/40 bg-gray-50 dark:bg-gray-900 cursor-wait"
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
                          <span className="text-xs font-medium text-primary animate-pulse">{t.crm.products.modal.uploading}</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center mb-2 transition-transform">
                            <UploadCloud size={20} className="text-gray-400 group-hover:text-primary" />
                          </div>
                          <span className="text-xs font-semibold text-gray-500 group-hover:text-primary">{t.crm.products.modal.addPhoto}</span>
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

                <p className="text-xs text-gray-400 italic">
                  {t.crm.products.modal.imageTip}
                </p>
              </div>

              {/* Columna Derecha: Detalles según el tipo */}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{selectedItemType === "SERVICE" ? t.productsAdmin.serviceName : t.crm.products.modal.name}</label>
                  <input {...register("name")} className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:bg-white transition-all" placeholder={selectedItemType === "SERVICE" ? t.productsAdmin.servicePlaceholder : t.productsAdmin.productPlaceholder} />
                  {errors.name && <p className="text-red-500 text-xs mt-1 font-medium">{translateValidation(t, errors.name.message)}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{t.crm.products.modal.description}</label>
                  <textarea {...register("description")} rows={3} className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:bg-white transition-all resize-none text-sm" placeholder={selectedItemType === "SERVICE" ? t.productsAdmin.serviceDescPlaceholder : ""} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{t.crm.products.modal.price}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input {...register("price", { valueAsNumber: true })} type="number" step="0.01" className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 pl-7" placeholder="0.00" />
                    </div>
                    {errors.price && <p className="text-red-500 text-xs mt-1 font-medium">{translateValidation(t, errors.price.message)}</p>}
                  </div>
                  <div>
                    {selectedItemType === "PHYSICAL" ? (
                      <>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{t.crm.products.modal.stock}</label>
                        <input {...register("stock", { valueAsNumber: true })} type="number" className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800" />
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5 flex items-center gap-1">
                          <Clock size={13} className="text-primary" /> {t.productsAdmin.duration}
                        </label>
                        <input {...register("durationMinutes", { setValueAs: toNumberOrNull })} type="number" placeholder={t.productsAdmin.durationPlaceholder} className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800" />
                      </>
                    )}
                  </div>
                </div>

                {selectedItemType === "SERVICE" && profile.showCapacity && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{t.productsAdmin.capacity}</label>
                    <input {...register("capacity", { setValueAs: toNumberOrNull })} type="number" placeholder={t.productsAdmin.capacityPlaceholder} className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800" />
                  </div>
                )}

                {selectedItemType === "SERVICE" && isBookingEnabled && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                    <input {...register("requiresBooking")} type="checkbox" id="requiresBooking" className="w-4 h-4 accent-primary rounded cursor-pointer" />
                    <div>
                      <label htmlFor="requiresBooking" className="text-xs font-semibold text-gray-900 dark:text-gray-200 block cursor-pointer">{t.productsAdmin.bookingEnable}</label>
                      <p className="text-xs text-gray-500">{t.productsAdmin.bookingEnableDesc}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{selectedItemType === "SERVICE" ? t.productsAdmin.specialty : t.crm.products.modal.category}</label>
                  <input {...register("category")} className="input bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800" placeholder={selectedItemType === "SERVICE" ? t.productsAdmin.specialtyPlaceholder : ""} />
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 select-none cursor-pointer" onClick={() => (document.getElementById('isActive') as HTMLInputElement).click()}>
                  <input {...register("isActive")} type="checkbox" id="isActive" className="w-5 h-5 accent-primary rounded-md cursor-pointer" />
                  <div>
                    <label htmlFor="isActive" className="text-sm font-semibold text-gray-900 dark:text-gray-200 block cursor-pointer">{t.crm.products.modal.visible}</label>
                    <p className="text-xs text-gray-500">{t.crm.products.modal.visibleDesc}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 py-3 font-semibold text-gray-600">{t.crm.products.modal.cancel}</button>
              <button type="submit" disabled={loading} className="btn-primary flex-[2] py-3 flex items-center justify-center gap-2 font-semibold ">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={18} />
                    {editing ? t.crm.products.modal.updateBtn : t.crm.products.modal.createBtn}
                  </>
                )}
              </button>
            </div>
          </form>
        </FormPanel>
      )}

      {loadingProducts ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 animate-pulse">{t.crm.products.loading}</p>
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
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{p.name}</p>
                    {p.itemType === "SERVICE" && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-100 dark:bg-gray-800 text-primary dark:bg-gray-800 dark:text-primary">
                        {t.productsAdmin.bookingBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-primary font-semibold text-sm">{formatPrice(p.price, locale)}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`badge text-xs ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.isActive ? t.crm.products.active : t.crm.products.inactive}</span>
                    {p.itemType === "SERVICE" ? (
                      <span className="badge text-xs bg-gray-100 dark:bg-gray-800 text-primary dark:bg-gray-800 dark:text-primary flex items-center gap-1">
                        <Clock size={11} /> {p.durationMinutes ? fill(t.productUi.minutesShort, { minutes: p.durationMinutes }) : t.productUi.service}
                      </span>
                    ) : (
                      <span className={`badge text-xs ${p.stock <= 5 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700 dark:text-gray-200"}`}>{t.crm.products.stock} {p.stock}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors"><Pencil size={16} /></button>
                  <button onClick={() => deleteProduct(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">{t.crm.products.noProducts}</p>}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  {[t.crm.products.columns.product, t.crm.products.columns.price, t.crm.products.columns.stock, t.crm.products.columns.category, t.crm.products.columns.status, ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 ">{h}</th>
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
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                            {p.itemType === "SERVICE" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-primary dark:bg-gray-800 dark:text-primary">
                                <Clock size={10} /> {t.productUi.service} {p.durationMinutes ? `• ${p.durationMinutes}m` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{formatPrice(p.price, locale)}</td>
                    <td className="px-4 py-3">
                      {p.itemType === "SERVICE" ? (
                        <span className="text-xs text-gray-400 italic flex items-center gap-1">
                          <Calendar size={13} className="text-primary" /> {t.productsAdmin.agenda}
                        </span>
                      ) : (
                        <span className={`badge ${p.stock <= 5 ? "bg-red-100 text-red-700" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>{p.stock}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category ?? "—"}</td>
                    <td className="px-4 py-3"><span className={`badge ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>{p.isActive ? t.crm.products.active : t.crm.products.inactive}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-primary transition-colors"><Pencil size={16} /></button>
                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (<tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">{t.crm.products.noProducts}</td></tr>)}
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

      {pendingFile && (
        <ImageCropperModal
          file={pendingFile}
          title={t.crm.products.modal.cropTitle}
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

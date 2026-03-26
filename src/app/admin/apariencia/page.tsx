"use client";
// src/app/admin/apariencia/page.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { themeSchema, type ThemeInput } from "@/lib/validations";
import { Check, Palette, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

export default function AparienciaPage() {
  const [saved, setSaved] = useState(false);
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState({ primaryColor: "#16a34a", secondaryColor: "#15803d", accentColor: "#4ade80", fontFamily: "Inter, sans-serif" });

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<ThemeInput>({
    resolver: zodResolver(themeSchema),
    defaultValues: preview,
  });

  const values = watch();

  useEffect(() => {
    setMounted(true);
    fetch("/api/theme").then(r => r.json()).then(data => { reset(data); setPreview(data); });
  }, [reset]);

  // Live preview
  useEffect(() => {
    if (values.primaryColor) document.documentElement.style.setProperty("--color-primary", values.primaryColor);
    if (values.secondaryColor) document.documentElement.style.setProperty("--color-secondary", values.secondaryColor);
    if (values.accentColor) document.documentElement.style.setProperty("--color-accent", values.accentColor);
    if (values.fontFamily) document.documentElement.style.setProperty("--font-family-base", values.fontFamily);
  }, [values]);

  const onSubmit = async (data: ThemeInput) => {
    await fetch("/api/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Apariencia</h1>
      <p className="text-gray-500 text-sm mb-8">Personaliza los colores de tu tienda</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Color form */}
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Palette size={22} className="text-primary" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Colores del tema</h2>
          </div>

          {[
            { name: "primaryColor" as const, label: "Color primario", hint: "Botones, precios, links principales" },
            { name: "secondaryColor" as const, label: "Color secundario", hint: "Hover, fondos de énfasis" },
            { name: "accentColor" as const, label: "Color de acento", hint: "Detalles, badges, highlights" },
          ].map((field) => (
            <div key={field.name} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-gray-200/20 group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">{field.label}</label>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight">{field.hint}</p>
                </div>
              </div>
              
              <div className="relative group/input flex items-center">
                {/* Clickable Swatch Prefix */}
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all overflow-hidden"
                     style={{ backgroundColor: values[field.name] || "#000000" }}
                     onClick={() => (document.getElementById(`picker-${field.name}`) as HTMLInputElement)?.click()}
                >
                  <input 
                    id={`picker-${field.name}`}
                    type="color" 
                    value={values[field.name] || "#000000"}
                    onChange={(e) => setValue(field.name, e.target.value, { shouldValidate: true, shouldDirty: true })}
                    className="opacity-0 absolute inset-0 cursor-pointer w-full h-full scale-150" 
                  />
                </div>
                
                <input 
                  {...register(field.name)} 
                  type="text" 
                  className="input pl-12 pr-4 py-3 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 font-mono uppercase text-sm font-bold focus:ring-primary/10 transition-all shadow-inner tracking-widest" 
                  placeholder="#000000" 
                  onChange={(e) => {
                    const val = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                    setValue(field.name, val, { shouldValidate: true, shouldDirty: true });
                  }}
                  value={values[field.name] || ""}
                />
              </div>
              {errors[field.name] && <p className="text-red-500 text-[10px] mt-2 font-medium bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded inline-block">{errors[field.name]?.message}</p>}
            </div>
          ))}

          <div className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-primary rounded-full" /> Tipografía Principal
            </label>
            <p className="text-[10px] text-gray-400 mb-4 font-medium italic">Define el carácter visual de todo tu sitio y paneles</p>
            <select 
              {...register("fontFamily")} 
              className="input w-full bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 cursor-pointer text-sm font-medium"
            >
              <option value="Inter, sans-serif">Inter (Moderno y Limpio)</option>
              <option value="'Playfair Display', serif">Playfair Display (Elegante y Clásico)</option>
              <option value="Roboto, sans-serif">Roboto (Profesional y Neutro)</option>
              <option value="'Montserrat', sans-serif">Montserrat (Geométrico y Fresco)</option>
              <option value="'Comic Sans MS', cursive">Cómic (Divertido y Casual)</option>
            </select>
          </div>

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-4 mt-4 font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
            {saved ? <><Check size={20} /> ¡Cambios Guardados!</> : "Aplicar diseño a la tienda"}
          </button>
        </form>

        {/* Global toggles and Preview */}
        <div className="flex flex-col gap-6">
          {/* Dark Mode Toggle */}
          <div className="card border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <Sun size={18} className="text-amber-500" /> Esquema de Color
            </h2>
            <p className="text-[10px] text-gray-500 font-medium mb-6">Elige el ambiente para tus clientes (Modo)</p>
            {mounted && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: "light", label: "Claro", icon: Sun },
                  { id: "dark", label: "Oscuro", icon: Moon },
                  { id: "system", label: "Sistema", icon: Monitor },
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setTheme(mode.id)}
                      className={`flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 transition-all ${theme === mode.id ? "border-primary bg-primary/5 text-primary shadow-inner" : "border-gray-100 dark:border-gray-800 text-gray-400 hover:border-gray-200 dark:hover:border-gray-700"}`}
                    >
                      <Icon size={24} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Vista previa en tiempo real</h2>
            <div className="space-y-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900/50">
            {/* Simulated navbar */}
            <div 
              className="bg-white dark:bg-gray-900 border-b border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm"
              style={{ fontFamily: values.fontFamily }}
            >
              <span className="font-bold text-sm" style={{ color: values.primaryColor }}>Mi Clínica</span>
              <div className="flex gap-3 text-xs">
                <span className="text-gray-600 dark:text-gray-400">Productos</span>
                <span className="px-3 py-1 rounded-full text-white text-xs" style={{ background: values.primaryColor }}>Entrar</span>
              </div>
            </div>

            {/* Simulated product card */}
            <div 
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              style={{ fontFamily: values.fontFamily }}
            >
              <div className="h-24 rounded-t-xl" style={{ background: values.accentColor + "40" }} />
              <div className="p-3">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">Plan Detox 7 días</p>
                <p className="font-bold mt-1 text-lg" style={{ color: values.primaryColor }}>$1,200</p>
                <button className="mt-2 w-full text-white text-xs py-2 rounded-lg font-medium transition-all hover:scale-[1.02]" style={{ background: values.primaryColor, boxShadow: `0 4px 14px 0 ${values.primaryColor}50` }}>
                  Agregar al carrito
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

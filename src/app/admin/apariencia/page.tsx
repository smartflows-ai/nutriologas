"use client";
// src/app/admin/apariencia/page.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { themeSchema, type ThemeInput } from "@/lib/validations";
import { Check, Palette } from "lucide-react";

export default function AparienciaPage() {
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState({ primaryColor: "#16a34a", secondaryColor: "#15803d", accentColor: "#4ade80" });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<ThemeInput>({
    resolver: zodResolver(themeSchema),
    defaultValues: preview,
  });

  const values = watch();

  useEffect(() => {
    fetch("/api/theme").then(r => r.json()).then(data => { reset(data); setPreview(data); });
  }, [reset]);

  // Live preview
  useEffect(() => {
    if (values.primaryColor) document.documentElement.style.setProperty("--color-primary", values.primaryColor);
    if (values.secondaryColor) document.documentElement.style.setProperty("--color-secondary", values.secondaryColor);
    if (values.accentColor) document.documentElement.style.setProperty("--color-accent", values.accentColor);
  }, [values]);

  const onSubmit = async (data: ThemeInput) => {
    await fetch("/api/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Apariencia</h1>
      <p className="text-gray-500 text-sm mb-8">Personaliza los colores de tu tienda</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Color form */}
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Palette size={22} className="text-primary" />
            <h2 className="font-semibold text-gray-900">Colores del tema</h2>
          </div>

          {[
            { name: "primaryColor" as const, label: "Color primario", hint: "Botones, precios, links principales" },
            { name: "secondaryColor" as const, label: "Color secundario", hint: "Hover, fondos de énfasis" },
            { name: "accentColor" as const, label: "Color de acento", hint: "Detalles, badges, highlights" },
          ].map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <p className="text-xs text-gray-400 mb-2">{field.hint}</p>
              <div className="flex items-center gap-3">
                <input {...register(field.name)} type="color" className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                <input {...register(field.name)} type="text" className="input flex-1 font-mono uppercase" placeholder="#000000" />
              </div>
              {errors[field.name] && <p className="text-red-500 text-xs mt-1">{errors[field.name]?.message}</p>}
            </div>
          ))}

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {saved ? <><Check size={18} /> Guardado</> : "Guardar cambios"}
          </button>
        </form>

        {/* Preview */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Vista previa en tiempo real</h2>
          <div className="space-y-4 p-4 border border-gray-100 rounded-xl bg-gray-50">
            {/* Simulated navbar */}
            <div className="bg-white border-b border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
              <span className="font-bold text-sm" style={{ color: values.primaryColor }}>Mi Clínica</span>
              <div className="flex gap-3 text-xs">
                <span className="text-gray-600">Productos</span>
                <span className="px-3 py-1 rounded-full text-white text-xs" style={{ background: values.primaryColor }}>Entrar</span>
              </div>
            </div>

            {/* Simulated product card */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="h-24 rounded-t-xl" style={{ background: values.accentColor + "40" }} />
              <div className="p-3">
                <p className="font-semibold text-sm text-gray-900">Plan Detox 7 días</p>
                <p className="font-bold mt-1" style={{ color: values.primaryColor }}>$1,200</p>
                <button className="mt-2 w-full text-white text-xs py-1.5 rounded-lg" style={{ background: values.primaryColor }}>
                  Agregar al carrito
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

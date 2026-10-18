"use client";
// src/components/shop/BookingFlow.tsx
import { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  CheckCircle2, 
  MessageCircle, 
  Sparkles,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

interface Props {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
    description: string | null;
    durationMinutes: number | null;
    category: string | null;
  };
  tenant: {
    name: string;
    whatsappNumber: string | null;
    logoUrl: string | null;
  };
}

export default function BookingFlow({ product, tenant }: Props) {
  // Generar próximos 14 días disponibles (excluyendo domingos)
  const availableDays = (() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 21; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() !== 0) { // Excluir domingo por default
        days.push({
          dateStr: d.toISOString().split("T")[0],
          dayName: d.toLocaleDateString("es-MX", { weekday: "short" }),
          dayNum: d.getDate(),
          monthName: d.toLocaleDateString("es-MX", { month: "short" }),
        });
      }
    }
    return days;
  })();

  const [selectedDate, setSelectedDate] = useState<string>(availableDays[0]?.dateStr || "");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  // Step 2: Patient Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 3: Success Confirmation
  const [confirmedAppointment, setConfirmedAppointment] = useState<any | null>(null);

  // Cargar slots disponibles cuando cambia la fecha
  useEffect(() => {
    if (!selectedDate) return;
    async function loadAvailability() {
      setLoadingSlots(true);
      setSelectedSlot("");
      try {
        const res = await fetch(`/api/appointments/availability?productId=${product.id}&date=${selectedDate}`);
        const data = await res.json();
        setSlots(data.availableSlots || []);
      } catch (e) {
        console.error("Error loading availability:", e);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadAvailability();
  }, [selectedDate, product.id]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) {
      setError("Por favor selecciona una fecha y horario para tu cita.");
      return;
    }
    if (!name || !phone || !email) {
      setError("Por favor completa tu nombre, teléfono y correo electrónico.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const appointmentDateTime = `${selectedDate}T${selectedSlot}:00.000Z`;
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          appointmentDate: appointmentDateTime,
          clientName: name,
          clientPhone: phone,
          clientEmail: email,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo agendar la cita.");
      }

      setConfirmedAppointment(data);
    } catch (e: any) {
      setError(e.message || "Error al confirmar la cita");
    } finally {
      setSubmitting(false);
    }
  };

  // WhatsApp click handler
  const getWhatsAppBookingLink = () => {
    if (!tenant.whatsappNumber) return "#";
    const cleanPhone = tenant.whatsappNumber.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Hola ${tenant.name}, acabo de agendar una cita para "${product.name}" el día ${selectedDate} a las ${selectedSlot} hrs a nombre de ${name}. ¿Me podrían confirmar? Muchas gracias.`
    );
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  // ── PANTALLA DE ÉXITO ───────────────────────────────────────
  if (confirmedAppointment) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 animate-fade-in text-center">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/10">
          <CheckCircle2 size={44} />
        </div>

        <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          Cita Registrada con Éxito
        </span>

        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mt-3">
          ¡Nos vemos pronto, {name.split(" ")[0]}!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          Hemos recibido tu solicitud de cita para <strong className="text-gray-800 dark:text-gray-200">{product.name}</strong>. En breve recibirás confirmación.
        </p>

        {/* Resumen de la cita */}
        <div className="card p-6 my-8 text-left space-y-4 border border-violet-100 dark:border-violet-900/30 bg-violet-50/30 dark:bg-violet-950/20">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Servicio</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{product.name}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Fecha y Hora</span>
            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
              {selectedDate} a las {selectedSlot} hrs
            </span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Duración</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{product.durationMinutes || 30} minutos</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Inversión</span>
            <span className="text-base font-black text-gray-900 dark:text-white">{formatPrice(product.price)}</span>
          </div>
        </div>

        {/* WhatsApp CTA */}
        {tenant.whatsappNumber && (
          <a
            href={getWhatsAppBookingLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all mb-4"
          >
            <MessageCircle size={20} />
            Confirmar de inmediato por WhatsApp
          </a>
        )}

        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-gray-500 mt-6">
          <Link href="/mis-citas" className="hover:text-violet-600 underline">
            Ver en Mis Citas
          </Link>
          <span>•</span>
          <Link href="/" className="hover:text-violet-600 underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ── FORMULARIO DE AGENDAMIENTO ──────────────────────────────
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-gray-100 dark:border-gray-800 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 flex items-center gap-1.5">
              <Clock size={13} /> {product.durationMinutes || 30} minutos de sesión
            </span>
            {product.category && (
              <span className="text-xs text-gray-400 font-medium">
                • {product.category}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
            {product.name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xl">
            {product.description || "Agenda tu consulta médica en línea con confirmación instantánea."}
          </p>
        </div>

        <div className="text-left md:text-right flex-shrink-0 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
          <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block">Costo de la consulta</span>
          <span className="text-2xl font-black text-gray-900 dark:text-white">{formatPrice(product.price)}</span>
        </div>
      </div>

      <form onSubmit={handleBookingSubmit} className="space-y-10">
        {/* Paso 1: Seleccionar Fecha */}
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            Selecciona la fecha de tu cita
          </h3>

          <div className="flex gap-2 overflow-x-auto pb-3 pt-1 scrollbar-none">
            {availableDays.map((d) => {
              const isSelected = selectedDate === d.dateStr;
              return (
                <button
                  type="button"
                  key={d.dateStr}
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`flex flex-col items-center justify-center min-w-[70px] py-3.5 px-3 rounded-2xl border transition-all text-center flex-shrink-0 ${
                    isSelected
                      ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/30 scale-105"
                      : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-violet-500/50"
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold opacity-80">{d.dayName}</span>
                  <span className="text-xl font-black my-0.5">{d.dayNum}</span>
                  <span className="text-[10px] font-medium opacity-80">{d.monthName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Paso 2: Seleccionar Horario */}
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">2</span>
            Selecciona un horario disponible
          </h3>

          {loadingSlots ? (
            <div className="flex items-center gap-3 py-6 text-gray-400 text-xs">
              <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              Verificando disponibilidad de horarios en la agenda...
            </div>
          ) : slots.length === 0 ? (
            <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>No hay horarios disponibles para esta fecha. Por favor selecciona otro día en el calendario arriba.</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {slots.map((slot) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    type="button"
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/25 scale-102"
                        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-violet-500/50 hover:bg-violet-50/50 dark:hover:bg-violet-950/30"
                    }`}
                  >
                    <Clock size={12} className={isSelected ? "text-white" : "text-violet-500"} />
                    {slot}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Paso 3: Datos del Paciente */}
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">3</span>
            Datos del paciente
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <User size={13} className="text-violet-600" /> Nombre completo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Ana Martínez"
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <Phone size={13} className="text-violet-600" /> Teléfono WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. +52 55 1234 5678"
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <Mail size={13} className="text-violet-600" /> Correo electrónico *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-violet-600" /> Motivo de consulta o notas para el especialista (opcional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Revisión anual, seguimiento de tratamiento, dudas sobre síntomas..."
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-rose-600 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>Tus datos médicos se transmiten de forma 100% segura y privada.</span>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedSlot}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-sm shadow-xl shadow-violet-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Agendando tu cita...
              </>
            ) : (
              <>
                Confirmar y Reservar Cita
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

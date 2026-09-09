"use client";

import { useState, useEffect } from "react";
import { User, Activity, AlertTriangle, Target, Clock, Pill, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useTranslation } from "@/i18n";

interface PatientProfile {
  id: string;
  user: {
    name: string;
    email: string;
  };
  remoteJid: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goals: string | null;
  allergies: string | null;
  medicalHistory: string | null;
  medications: string | null;
  isTriageComplete: boolean;
  updatedAt: string;
}

export default function PacientesPage() {
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useTranslation();
  const dateLocale = lang === 'es' ? es : enUS;

  useEffect(() => {
    fetch("/api/admin/pacientes")
      .then(res => res.json())
      .then(data => {
        setPatients(data.patients || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 h-[50vh]">
        <Loader2 className="animate-spin text-primary mb-4" size={32} />
        <p className="text-gray-500">{t.crm.triage.loading}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#07070f]">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t.crm.triage.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{t.crm.triage.desc}</p>
          </div>
        </div>

        {patients.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <User size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t.crm.triage.noPatientsTitle}</h2>
            <p className="text-gray-500">{t.crm.triage.noPatientsDesc}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {patients.map(patient => (
              <div key={patient.id} className="card hover:shadow-lg transition-shadow bg-white dark:bg-gray-900 overflow-hidden relative">
                {patient.isTriageComplete && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                    {t.crm.triage.complete}
                  </div>
                )}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary flex-shrink-0">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{patient.user.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{patient.remoteJid ? patient.remoteJid.replace("@s.whatsapp.net", "") : patient.user.email}</span>
                      <span>•</span>
                      <Clock size={12} />
                      <span>{t.crm.triage.updated} {formatDistanceToNow(new Date(patient.updatedAt), { addSuffix: true, locale: dateLocale })}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-center">
                    <span className="block text-xs text-gray-500 uppercase font-semibold mb-1">{t.crm.triage.age}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{patient.age ? `${patient.age} ${t.crm.triage.years}` : "--"}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-center">
                    <span className="block text-xs text-gray-500 uppercase font-semibold mb-1">{t.crm.triage.weight}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{patient.weightKg ? `${patient.weightKg} kg` : "--"}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-center">
                    <span className="block text-xs text-gray-500 uppercase font-semibold mb-1">{t.crm.triage.height}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{patient.heightCm ? `${patient.heightCm} cm` : "--"}</span>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  {patient.goals && (
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-1"><Target size={14} className="text-blue-500"/> {t.crm.triage.goals}</h4>
                      <p className="text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50">{patient.goals}</p>
                    </div>
                  )}
                  {patient.allergies && (
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-1"><AlertTriangle size={14} className="text-orange-500"/> {t.crm.triage.allergies}</h4>
                      <p className="text-gray-600 dark:text-gray-400">{patient.allergies}</p>
                    </div>
                  )}
                  {patient.medicalHistory && (
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-1"><Activity size={14} className="text-red-500"/> {t.crm.triage.medicalHistory}</h4>
                      <p className="text-gray-600 dark:text-gray-400">{patient.medicalHistory}</p>
                    </div>
                  )}
                  {patient.medications && (
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-1"><Pill size={14} className="text-purple-500"/> {t.crm.triage.medications}</h4>
                      <p className="text-gray-600 dark:text-gray-400">{patient.medications}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

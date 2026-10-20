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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Activity className="text-primary" size={26} />
            {t.crm.triage.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t.crm.triage.desc}</p>
        </div>
      </div>

        {patients.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <User size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t.crm.triage.noPatientsTitle}</h2>
            <p className="text-gray-500">{t.crm.triage.noPatientsDesc}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {patients.map(patient => (
              <div key={patient.id} className="card transition-shadow bg-white dark:bg-gray-900 overflow-hidden relative">
                {patient.isTriageComplete && (
                  <div className="absolute top-0 right-0 bg-primary text-white text-xs font-semibold px-3 py-1 rounded-bl-lg ">
                    {t.crm.triage.complete}
                  </div>
                )}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-primary flex-shrink-0">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{patient.user.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{patient.remoteJid ? patient.remoteJid.replace("@s.whatsapp.net", "") : patient.user.email}</span>
                      <span>•</span>
                      <Clock size={12} />
                      <span>{t.crm.triage.updated} {formatDistanceToNow(new Date(patient.updatedAt), { addSuffix: true, locale: dateLocale })}</span>
                    </div>
                  </div>
                </div>

                {(patient.age || patient.weightKg || patient.heightCm) ? (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {patient.age ? (
                      <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl text-center border border-gray-100 dark:border-gray-800">
                        <span className="block text-xs text-gray-500 font-semibold mb-1">{t.crm.triage.age}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{patient.age} {t.crm.triage.years}</span>
                      </div>
                    ) : null}
                    {patient.weightKg ? (
                      <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl text-center border border-gray-100 dark:border-gray-800">
                        <span className="block text-xs text-gray-500 font-semibold mb-1">{t.crm.triage.weight}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{patient.weightKg}</span>
                      </div>
                    ) : null}
                    {patient.heightCm ? (
                      <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl text-center border border-gray-100 dark:border-gray-800">
                        <span className="block text-xs text-gray-500 font-semibold mb-1">{t.crm.triage.height}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{patient.heightCm}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-3 text-sm">
                  {patient.goals && (
                    <div className="bg-gray-100 dark:bg-gray-800 p-3.5 rounded-xl border border-primary/80 dark:border-primary/30">
                      <h4 className="flex items-center gap-2 font-semibold text-primary dark:text-primary mb-1">
                        <Target size={15} className="text-primary"/> {t.crm.triage.goals}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{patient.goals}</p>
                    </div>
                  )}
                  {patient.allergies && (
                    <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-100/80 dark:border-amber-900/30">
                      <h4 className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300 mb-1">
                        <AlertTriangle size={15} className="text-amber-500"/> {t.crm.triage.allergies}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{patient.allergies}</p>
                    </div>
                  )}
                  {patient.medicalHistory && (
                    <div className="bg-gray-50 dark:bg-gray-900 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800">
                      <h4 className="flex items-center gap-2 font-semibold text-secondary mb-1">
                        <Activity size={15} className="text-secondary"/> {t.crm.triage.medicalHistory}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{patient.medicalHistory}</p>
                    </div>
                  )}
                  {patient.medications && (
                    <div className="bg-gray-50 dark:bg-gray-900 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800">
                      <h4 className="flex items-center gap-2 font-semibold text-primary mb-1">
                        <Pill size={15} className="text-primary"/> {t.crm.triage.medications}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{patient.medications}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}

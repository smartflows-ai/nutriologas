"use client";
import { useState, useEffect } from "react";
import { Trash2, Plus, GripVertical, Check, Pencil, Eye, EyeOff, X } from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchFaqs = async () => {
    const res = await fetch(`/api/faqs?t=${Date.now()}`);
    if (res.ok) setFaqs(await res.json());
  };

  useEffect(() => { fetchFaqs(); }, []);

  const addFaq = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: newQuestion.trim(), answer: newAnswer.trim() }),
      });
      if (res.ok) {
        const newFaq = await res.json();
        setFaqs((prev) => [...prev, newFaq]);
        setNewQuestion("");
        setNewAnswer("");
        setShowAddForm(false);
      }
    } finally {
      setAdding(false);
    }
  };

  const deleteFaq = async (id: string) => {
    if (!confirm("¿Eliminar esta pregunta frecuente?")) return;
    await fetch(`/api/faqs/${id}`, { method: "DELETE" });
    fetchFaqs();
  };

  const toggleActive = async (faq: FAQ) => {
    await fetch(`/api/faqs/${faq.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...faq, isActive: !faq.isActive }),
    });
    setFaqs((prev) => prev.map((f) => (f.id === faq.id ? { ...f, isActive: !f.isActive } : f)));
  };

  const startEditing = (faq: FAQ) => {
    setEditingId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await fetch(`/api/faqs/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: editQuestion.trim(), answer: editAnswer.trim() }),
      });
      setFaqs((prev) =>
        prev.map((f) =>
          f.id === editingId ? { ...f, question: editQuestion.trim(), answer: editAnswer.trim() } : f
        )
      );
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  // Drag & drop reorder
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;
    const from = faqs.findIndex((i) => i.id === dragging);
    const to = faqs.findIndex((i) => i.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...faqs];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setFaqs(reordered);
  };
  const handleDrop = async () => {
    setDragging(null);
    await fetch("/api/faqs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: faqs.map((f, i) => ({ id: f.id, sortOrder: i })) }),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preguntas Frecuentes (FAQ)</h1>
          <p className="text-gray-500 text-sm">Administra las respuestas rápidas que aparecen en el centro de ayuda.</p>
        </div>
        {!showAddForm && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> Nueva Pregunta
          </button>
        )}
      </div>

      {/* Agregar FAQ */}
      {showAddForm && (
        <div className="card mb-8 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus size={18} className="text-primary" />
              </div> 
              Agregar nueva pregunta
            </h2>
            <button 
              onClick={() => setShowAddForm(false)}
              className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Pregunta *</label>
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                className="input min-h-[120px] resize-none bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                placeholder="Ej: ¿Cuáles son las formas de pago?"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Respuesta *</label>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                className="input min-h-[120px] resize-none bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                placeholder="Ej: Aceptamos tarjetas de crédito, débito y transferencias bancarias..."
              />
            </div>
          </div>
          
          <div className="flex gap-3">
             <button
              onClick={addFaq}
              disabled={!newQuestion.trim() || !newAnswer.trim() || adding}
              className="btn-primary flex items-center justify-center gap-2 px-6 h-11 font-bold shadow-lg shadow-primary/20"
            >
              {adding ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : <Check size={18} />}
              {adding ? "Guardando..." : "Guardar Pregunta"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="btn-ghost px-6 h-11 font-semibold text-gray-500"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de FAQs */}
      <div>
        <h2 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Check size={18} className="text-gray-500" />
          </div>
          Preguntas actuales ({faqs.length})
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
            Click & Arrastra para reordenar
          </span>
        </h2>

        {faqs.length === 0 ? (
          <div className="card text-center py-10 text-gray-400">
            <p className="text-sm">No hay preguntas frecuentes aún.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={faq.id}
                draggable
                onDragStart={() => handleDragStart(faq.id)}
                onDragOver={(e) => handleDragOver(e, faq.id)}
                onDrop={handleDrop}
                className={`card flex gap-4 p-4 cursor-grab active:cursor-grabbing transition-all ${
                  dragging === faq.id ? "opacity-50 scale-95" : ""
                }`}
              >
                <div className="flex items-center pt-1">
                  <GripVertical size={18} className="text-gray-300 flex-shrink-0" />
                  <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-center">{index + 1}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  {editingId === faq.id ? (
                    <div className="space-y-3">
                      <div>
                        <textarea
                          value={editQuestion}
                          onChange={(e) => setEditQuestion(e.target.value)}
                          className="input text-sm font-medium mb-2 min-h-[80px] resize-none"
                          placeholder="Pregunta"
                        />
                        <textarea
                          value={editAnswer}
                          onChange={(e) => setEditAnswer(e.target.value)}
                          className="input text-sm min-h-[80px] resize-none"
                          placeholder="Respuesta"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={savingEdit} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 w-max">
                          <Check size={14} /> Guardar
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-ghost py-1.5 px-3 text-xs w-max">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold ${!faq.isActive ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}>
                          {faq.question}
                        </p>
                        <span className={`badge text-[10px] ${faq.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {faq.isActive ? "Visible" : "Oculto"}
                        </span>
                      </div>
                      <p className={`text-sm whitespace-pre-wrap ${!faq.isActive ? "text-gray-400" : "text-gray-600 dark:text-gray-400"}`}>
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>

                {editingId !== faq.id && (
                  <div className="flex flex-col gap-1 flex-shrink-0 justify-start">
                    <button
                      onClick={() => toggleActive(faq)}
                      title={faq.isActive ? "Ocultar" : "Mostrar"}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors flex justify-center"
                    >
                      {faq.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => startEditing(faq)}
                      title="Editar"
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors flex justify-center"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => deleteFaq(faq.id)}
                      title="Eliminar"
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors flex justify-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

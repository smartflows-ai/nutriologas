// src/components/shop/WhatsAppButton.tsx
import Link from "next/link";
import { MessageCircle } from "lucide-react";

export default function WhatsAppButton({ phone }: { phone: string }) {
  const clean = phone.replace(/\D/g, "");
  const url = `https://wa.me/${clean}?text=Hola,%20me%20gustaría%20más%20información`;
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20b858] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-transform hover:scale-110"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle size={28} fill="white" />
    </Link>
  );
}

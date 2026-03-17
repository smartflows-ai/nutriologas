// src/components/shop/Navbar.tsx
"use client";
import Link from "next/link";
import { ShoppingCart, User, Menu, X } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useEffect, useState } from "react";

export default function Navbar({ storeName }: { storeName: string }) {
  const itemCount = useCartStore((s) => s.itemCount());
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-primary">{storeName}</Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
          <Link href="/productos" className="hover:text-primary transition-colors">Productos</Link>
          <Link href="/carrito" className="relative hover:text-primary transition-colors">
            <ShoppingCart size={22} />
            {mounted && itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{itemCount}</span>
            )}
          </Link>
          <Link href="/login" className="btn-primary text-sm px-3 py-1.5">
            <User size={16} className="inline mr-1" /> Entrar
          </Link>
        </div>

        {/* Mobile menu */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
          <Link href="/productos" onClick={() => setOpen(false)} className="text-gray-700 font-medium">Productos</Link>
          <Link href="/carrito" onClick={() => setOpen(false)} className="text-gray-700 font-medium">
            Carrito{mounted ? ` (${itemCount})` : ""}
          </Link>
          <Link href="/login" onClick={() => setOpen(false)} className="btn-primary text-center">Entrar</Link>
        </div>
      )}
    </header>
  );
}

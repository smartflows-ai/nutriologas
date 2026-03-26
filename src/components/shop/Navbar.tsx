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
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-300">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-600 dark:to-emerald-400 tracking-tight">{storeName}</Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <Link href="/#nosotros" className="hover:text-primary dark:hover:text-primary transition-colors">Nosotros</Link>
          <Link href="/#servicios" className="hover:text-primary dark:hover:text-primary transition-colors">Servicios</Link>
          <Link href="/#faq" className="hover:text-primary dark:hover:text-primary transition-colors">FAQ</Link>
          <Link href="/productos" className="hover:text-primary dark:hover:text-primary transition-colors">Tienda</Link>
          
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
          
          <Link href="/carrito" className="relative text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-all hover:scale-105">
            <ShoppingCart size={22} />
            {mounted && itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-gradient-to-br from-primary to-emerald-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-sm font-bold border-2 border-white">{itemCount}</span>
            )}
          </Link>
          <Link href="/login" className="btn-primary text-sm px-5 py-2.5 shadow-sm">
            <User size={16} className="inline mr-1.5" /> Entrar
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors p-2" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>
      {open && (
        <div className="md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 px-6 py-6 flex flex-col gap-5 shadow-lg absolute w-full rounded-b-3xl">
          <Link href="/#nosotros" onClick={() => setOpen(false)} className="text-gray-700 dark:text-gray-200 font-medium hover:text-primary">Nosotros</Link>
          <Link href="/#servicios" onClick={() => setOpen(false)} className="text-gray-700 dark:text-gray-200 font-medium hover:text-primary">Servicios</Link>
          <Link href="/#faq" onClick={() => setOpen(false)} className="text-gray-700 dark:text-gray-200 font-medium hover:text-primary">FAQ</Link>
          <Link href="/productos" onClick={() => setOpen(false)} className="text-gray-700 dark:text-gray-200 font-medium hover:text-primary">Tienda</Link>
          
          <div className="h-px w-full bg-gray-100 dark:bg-gray-800 my-2"></div>
          
          <Link href="/carrito" onClick={() => setOpen(false)} className="text-gray-700 dark:text-gray-200 font-medium flex items-center justify-between">
            <span>Carrito de compras</span>
            {mounted && itemCount > 0 && <span className="bg-primary text-white text-xs px-2 py-1 rounded-full font-bold">{itemCount} items</span>}
          </Link>
          <Link href="/login" onClick={() => setOpen(false)} className="btn-primary text-center mt-2 flex justify-center items-center py-3">Entrar al Portal</Link>
        </div>
      )}
    </header>
  );
}

// src/components/shop/Navbar.tsx
"use client";
import Link from "next/link";
import { ShoppingCart, User, Menu, X, LogOut, ClipboardList, LayoutDashboard } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTranslation } from "@/i18n";

interface NavbarProps {
  storeName: string;
  logoUrl?: string | null;
}

export default function Navbar({ storeName, logoUrl }: NavbarProps) {
  const { t } = useTranslation();
  const itemCount = useCartStore((s) => s.itemCount());
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoggedIn = status === "authenticated";
  const isAdmin = session?.user?.role === "ADMIN";
  const userName = session?.user?.name ?? session?.user?.email;

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.25)] transition-all duration-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={storeName}
              className="w-10 h-10 object-contain rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-primary/20 shrink-0 transition-transform duration-200 group-hover:scale-105">
              {storeName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-bold text-xl sm:text-2xl text-gray-900 dark:text-white tracking-tight group-hover:text-primary transition-colors">
            {storeName}
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          <Link
            href="/#nosotros"
            className="px-3.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-gray-800/60 transition-all duration-150"
          >
            {t.shop.about}
          </Link>
          <Link
            href="/#servicios"
            className="px-3.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-gray-800/60 transition-all duration-150"
          >
            {t.shop.services}
          </Link>
          <Link
            href="/#faq"
            className="px-3.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-gray-800/60 transition-all duration-150"
          >
            {t.shop.faq}
          </Link>
          <Link
            href="/productos"
            className="px-4 py-2 rounded-xl text-primary font-semibold hover:bg-primary/10 transition-all duration-150"
          >
            {t.shop.store}
          </Link>
        </div>

        {/* Right Side Action Hub */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Shopping Cart Button */}
          <Link
            href="/carrito"
            className="relative p-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:text-primary hover:bg-primary/10 transition-all duration-200 flex items-center justify-center group"
            title={t.shop.cart}
            aria-label={t.shop.cart}
          >
            <ShoppingCart size={21} className="transition-transform duration-200 group-hover:scale-110" />
            {mounted && itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-extrabold shadow-md border-2 border-white dark:border-gray-950 animate-in zoom-in">
                {itemCount}
              </span>
            )}
          </Link>

          <div className="h-5 w-px bg-gray-200 dark:bg-gray-800 mx-0.5 hidden sm:block" />

          {/* User Auth Controls */}
          {isLoggedIn ? (
            <div className="hidden sm:flex items-center gap-2">
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-all"
                  title="Panel de Control CRM"
                >
                  <LayoutDashboard size={14} />
                  <span>CRM</span>
                </Link>
              )}
              <Link
                href="/mis-pedidos"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100/80 dark:bg-gray-900/80 hover:bg-gray-200/80 dark:hover:bg-gray-800 border border-gray-200/50 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all group"
                title={t.shop.myOrders}
              >
                <ClipboardList size={14} className="text-primary transition-transform duration-200 group-hover:scale-110" />
                <span className="truncate max-w-[120px]">{userName}</span>
              </Link>
              <button
                onClick={async () => { await signOut({ redirect: false }); window.location.href = "/"; }}
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                title={t.shop.signOut}
                aria-label={t.shop.signOut}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-95 shadow-sm shadow-primary/25 transition-all hover:shadow hover:-translate-y-0.5"
            >
              <User size={14} />
              <span>{t.shop.enter}</span>
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menú"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {open && (
        <div className="md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl border-t border-gray-100 dark:border-gray-800 px-6 py-6 flex flex-col gap-4 shadow-xl absolute w-full rounded-b-3xl animate-in slide-in-from-top-2">
          <Link
            href="/#nosotros"
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            {t.shop.about}
          </Link>
          <Link
            href="/#servicios"
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            {t.shop.services}
          </Link>
          <Link
            href="/#faq"
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            {t.shop.faq}
          </Link>
          <Link
            href="/productos"
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-xl text-primary font-bold hover:bg-primary/10 transition-colors"
          >
            {t.shop.store}
          </Link>
          
          <div className="h-px w-full bg-gray-100 dark:bg-gray-800 my-1" />
          
          <Link
            href="/carrito"
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 font-medium flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={18} />
              {t.shop.cart}
            </span>
            {mounted && itemCount > 0 && (
              <span className="bg-primary text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                {itemCount} {t.shop.cartItems}
              </span>
            )}
          </Link>

          {isLoggedIn ? (
            <div className="space-y-3 pt-2">
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary font-bold text-sm"
                >
                  <LayoutDashboard size={16} />
                  <span>Panel CRM</span>
                </Link>
              )}
              <Link
                href="/mis-pedidos"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
              >
                <ClipboardList size={16} />
                {t.shop.myOrders}
              </Link>
              <div className="flex items-center justify-between px-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 text-xs truncate max-w-[180px]">{userName}</span>
                <button
                  onClick={async () => {
                    setOpen(false);
                    await signOut({ redirect: false });
                    window.location.href = "/";
                  }}
                  className="text-xs text-red-500 font-semibold hover:underline"
                >
                  {t.shop.closeSession}
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="btn-primary text-center py-2.5 rounded-xl font-semibold shadow-sm mt-2"
            >
              <User size={16} className="inline mr-1" />
              {t.shop.enter}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

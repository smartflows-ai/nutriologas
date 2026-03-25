"use client";
// src/components/admin/AdminSidebar.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, Image, Palette,
  Calendar, Star, Bot, LogOut, Menu, X,
} from "lucide-react";
import SignOutButton from "@/components/admin/SignOutButton";

const navItems = [
  { href: "/admin/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/admin/productos",  label: "Productos",    icon: Package },
  { href: "/admin/pedidos",    label: "Pedidos",      icon: ShoppingBag },
  { href: "/admin/carrusel",   label: "Carrusel",     icon: Image },
  { href: "/admin/apariencia", label: "Apariencia",   icon: Palette },
  { href: "/admin/calendario", label: "Calendario",   icon: Calendar },
  { href: "/admin/reviews",    label: "Reviews",      icon: Star },
  { href: "/admin/asistente",  label: "Asistente IA", icon: Bot },
];

interface Props { userName?: string | null; }

export default function AdminSidebar({ userName }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile nav)
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand + close button (mobile only) */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg text-primary">CRM Nutrición</h1>
          <p className="text-xs text-gray-400 truncate max-w-[160px]">{userName}</p>
        </div>
        <button
          className="md:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors group
                ${active
                  ? "bg-primary/10 text-primary"
                  : "text-gray-700 hover:bg-primary/5 hover:text-primary"}`}
            >
              <Icon
                size={18}
                className={active ? "text-primary" : "text-gray-400 group-hover:text-primary transition-colors"}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4">
        <SignOutButton>
          <LogOut size={18} /> Cerrar sesión
        </SignOutButton>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile: hamburger button (top-left) ── */}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2.5 bg-white rounded-xl shadow-md border border-gray-200 text-gray-700"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* ── Mobile: backdrop overlay ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile: slide-in drawer ── */}
      <aside
        className={`
          md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* ── Desktop: static sidebar ── */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-gray-200 flex-shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}

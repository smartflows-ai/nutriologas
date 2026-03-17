// src/hooks/useToast.ts
export function toast(message: string) {
  // Simple toast — en produccion puedes reemplazar con sonner o react-hot-toast
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:#1f2937;color:white;padding:10px 20px;border-radius:8px;
    font-size:14px;z-index:9999;opacity:0;transition:opacity 0.2s;
    white-space:nowrap;pointer-events:none;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, 2500);
}

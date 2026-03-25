"use client";

export default function ConnectCalendarButton({ label = "Conectar Google Calendar" }: { label?: string }) {
  const handleConnect = () => {
    // Use the new OAuth start endpoint that properly handles subdomains
    const startUrl = `/api/apps/oauth/google/start?scope=https://www.googleapis.com/auth/calendar`;
    window.location.href = startUrl;
  };

  return (
    <button
      onClick={handleConnect}
      className="btn-primary flex items-center gap-2 text-sm"
    >
      {label}
    </button>
  );
}

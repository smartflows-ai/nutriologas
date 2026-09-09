function resolveTenantSlug(host) {
  const h = (host || "").toLowerCase().trim();
  if (!h) return "";
  const rootDomain = "newaigent.com";
  const hostWithoutPort = h.split(":")[0];

  if (
    hostWithoutPort === "localhost" ||
    hostWithoutPort === "127.0.0.1" ||
    hostWithoutPort.startsWith("192.168.") ||
    hostWithoutPort.startsWith("10.") ||
    hostWithoutPort.endsWith(".local")
  ) {
    return "";
  }

  if (hostWithoutPort.endsWith(".localhost")) {
    const sub = hostWithoutPort.replace(".localhost", "");
    return sub === "www" ? "" : sub;
  }

  if (
    hostWithoutPort === rootDomain ||
    hostWithoutPort === "www." + rootDomain ||
    hostWithoutPort === "newaigent.com" ||
    hostWithoutPort === "www.newaigent.com"
  ) {
    return "";
  }

  if (hostWithoutPort.endsWith("." + rootDomain)) {
    const sub = hostWithoutPort.replace("." + rootDomain, "");
    return sub === "www" ? "" : sub;
  }

  return hostWithoutPort;
}

const tests = [
  "localhost:3000",
  "localhost:3001",
  "127.0.0.1:3001",
  "newaigent.com",
  "www.newaigent.com",
  "doctor.localhost:3000",
  "doctor.localhost:3001",
  "doctor.newaigent.com",
  "myclinic.com:3000",
  "myclinic.com"
];

tests.forEach(t => console.log(t, "->", JSON.stringify(resolveTenantSlug(t))));
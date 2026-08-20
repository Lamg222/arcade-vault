import type { NextConfig } from "next";

/* IP local de la máquina de desarrollo (spec 08): permite que un móvil en la misma Wi-Fi hable con `next dev` sin que Next.js bloquee las peticiones cross-origin. Si la red cambia, obtén la IP nueva con `hostname -I` (WSL) y reemplázala aquí. */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.63"],
};

export default nextConfig;

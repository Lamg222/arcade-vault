import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acerca de",
};

// Placeholder "próximamente". La página About real (misión, highlights, formulario de
// contacto, terminal de éxito de references/home-about/about.jsx) queda fuera de este spec.
export default function AcercaPage() {
  return (
    <div className="fade-in mx-auto max-w-[720px] px-8 py-24 text-center">
      <div className="pixel neon-yellow mb-4 text-xs tracking-[0.24em]">▸ ACERCA DE</div>
      <div className="pixel neon-cyan mb-6 text-2xl">PRÓXIMAMENTE</div>
      <p className="mb-8 leading-8 text-[color:var(--ink-dim)]">
        Estamos construyendo esta sección. Pronto contaremos la historia de ARCADE VAULT,
        nuestra misión y cómo ponerte en contacto con el equipo.
      </p>
      <Link href="/" className="btn lg">
        VOLVER AL INICIO
      </Link>
    </div>
  );
}

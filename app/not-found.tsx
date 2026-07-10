import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fade-in mx-auto max-w-[720px] px-8 py-24 text-center">
      <div className="pixel neon-magenta mb-4 text-2xl">404</div>
      <div className="pixel neon-cyan mb-6 text-sm">JUEGO NO ENCONTRADO</div>
      <p className="mb-8 text-[color:var(--ink-dim)]">
        Este cartucho no existe en el Vault.
      </p>
      <Link href="/biblioteca" className="btn lg">
        VOLVER AL VAULT
      </Link>
    </div>
  );
}

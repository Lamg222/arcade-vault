"use client";

import { useEffect } from "react";

// Añade la clase "in" a cada elemento .reveal cuando entra en el viewport (una sola vez).
// Fiel al IntersectionObserver de references/home-about/home.jsx. Fallback: si el navegador
// no soporta IntersectionObserver, revela todo directamente (nunca deja contenido oculto).
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");

    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

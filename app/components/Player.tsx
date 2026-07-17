"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "../data/games";
import { useAuth } from "../context/AuthContext";
import { isGameToHost, type HostToGame } from "../lib/games/bridge";

export default function Player({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useAuth();

  const embed = game.embed; // si existe → juego real embebido (iframe); si no → arena mock
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : "INVITADO");
  const [saved, setSaved] = useState(false);

  // Envía un comando al juego embebido (solo tras el handshake `ready` y al mismo origen).
  const post = (msg: HostToGame) => {
    if (!readyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  };

  // Puente con el juego embebido: escucha estado real y lo refleja en el HUD React (REQ-04/05/06/08/10).
  useEffect(() => {
    if (!embed) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return; // REQ-10: ignora otros orígenes
      if (!isGameToHost(e.data)) return;
      const msg = e.data;
      switch (msg.type) {
        case "ready":
          readyRef.current = true;
          break;
        case "score":
          setScore(msg.value);
          break;
        case "lives":
          setLives(msg.value);
          break;
        case "level":
          setLevel(msg.value);
          break;
        case "paused":
          setPaused(msg.value);
          break;
        case "gameover":
          setScore(msg.score);
          setOver(true);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed]);

  // Loop de score mock: SOLO cuando el juego NO es embebido (REQ-11). Sin embed, comportamiento previo intacto.
  useEffect(() => {
    if (embed || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [embed, over, paused]);

  // Nivel: en embebido lo manda el juego (estado `level`); en mock se deriva del score (sin efecto, evita setState-en-effect).
  const levelDisplay = embed ? level : Math.floor(score / 2500) + 1;

  const togglePause = () => {
    if (embed) {
      // El juego es la fuente de verdad de la pausa: envía el comando y sincroniza vía el eco `paused`.
      post(paused ? { type: "resume" } : { type: "pause" });
    } else {
      setPaused((p) => !p);
    }
  };

  const endGame = () => {
    if (embed) post({ type: "pause" }); // congela el juego del iframe detrás del modal
    setOver(true);
  };

  const restart = () => {
    if (embed) post({ type: "restart" });
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v text-[color:var(--ink)]">{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(levelDisplay).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button className="btn ghost" onClick={() => router.push(`/juego/${game.id}`)}>
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {embed ? (
            <iframe
              ref={iframeRef}
              src={embed}
              title={game.title}
              className="game-frame"
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                display: "block",
                background: "#000",
              }}
              onLoad={() => iframeRef.current?.focus()}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {/* Overlay de pausa de la plataforma solo en modo mock; el juego embebido dibuja el suyo en el canvas. */}
          {!embed && paused && (
            <div className="crt-content z-[5] bg-black/60">
              <div>
                <div className="pixel neon-yellow text-[22px]">EN PAUSA</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-[color:var(--ink-dim)]">
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={() => setSaved(true)}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/biblioteca")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```


## Commands

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

No test runner is configured yet.

## Jugar desde el móvil (red local)

```bash
npm run dev:lan   # dev server escuchando en todas las interfaces (-H 0.0.0.0)
```

En el teléfono (misma Wi-Fi): `http://192.168.100.63:3000`. Bajo 768px de ancho el reproductor muestra un gamepad táctil (cruceta + A/B + pausa).

- La IP local está fijada en `next.config.ts` (`allowedDevOrigins`). Si la red cambia, obtén la nueva con `hostname -I` (WSL) y actualiza ambos lugares (config y esta URL).
- Ignora la línea `Network:` que imprime Next.js: en WSL2 suele mostrar la interfaz interna (`10.255.255.254`), inalcanzable desde el teléfono.
- Windows debe permitir el puerto 3000 en el firewall (regla clásica + regla Hyper-V para WSL, en PowerShell como administrador):

```powershell
New-NetFirewallRule -DisplayName "Arcade Vault dev 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallHyperVRule -DisplayName "WSL dev 3000" -Direction Inbound -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 3000
```

- Si aun así no carga, revisa que el router no tenga aislamiento de clientes (AP isolation).
# proxy-deepseek

Backend de function-calling acotado para que DeepSeek (u otro LLM compatible
con tool calling estilo OpenAI) pueda operar sobre GitHub, correr comandos
whitelisted y (próximamente) deploy en Railway — sin exponer las credenciales
reales ni dar shell arbitraria.

**Esto NO es un servidor MCP.** MCP es un protocolo específico (JSON-RPC,
tool discovery estandarizado). Esto es un backend HTTP propio en formato
function-calling estilo OpenAI, que es lo que DeepSeek soporta nativamente.

## Principios de seguridad

- Auth solo por header `Authorization: Bearer <token>`, nunca `?key=` en la URL.
- Cada tool es una función con parámetros tipados y validados con `zod`.
  No existe una tool de "ejecutar comando arbitrario".
- `run_command` usa una whitelist fija (`ALLOWED_COMMANDS`) y `execFile`
  (nunca `exec` con shell), evitando inyección de comandos.
- El workdir de ejecución está confinado a `sandbox/tmp/` con verificación
  anti path-traversal.
- Cada llamada a una tool queda registrada en `audit.log` (archivo local)
  y en stdout (visible en logs de Railway).
- Las credenciales reales (`GITHUB_TOKEN`, `RAILWAY_TOKEN`) viven solo en
  variables de entorno del servidor. Nunca llegan al LLM ni al cliente.

## Setup

```bash
cp .env.example .env
# completar PROXY_TOKEN (genera uno random) y GITHUB_TOKEN (fine-grained PAT)
npm install
npm run dev
```

## Endpoints

- `GET /tools` — devuelve el schema de tools en formato function-calling,
  para pasarlo directo al parámetro `tools` de la API de DeepSeek.
- `POST /tool` — ejecuta una tool: `{ "tool": "github_read_file", "params": {...} }`
- `GET /health` — healthcheck.

## Tools disponibles

| Tool | Descripción |
|---|---|
| `github_read_file` | Lee un archivo de un repo |
| `github_list_files` | Lista directorio |
| `github_write_file` | Crea/actualiza archivo en una rama |
| `github_create_branch` | Crea rama desde otra |
| `github_open_pr` | Abre PR |
| `github_get_pr_status` | Estado y checks de CI de un PR |
| `github_search_code` | Busca código en el repo |
| `run_command` | Ejecuta un comando de una lista fija (npm/git) en un sandbox |

## Pendiente / roadmap

- Tools de Railway (`railway_deploy`, `railway_get_logs`, `railway_get_status`)
- Sandboxing real con contenedor Docker efímero por ejecución de `run_command`
  (hoy corre en el mismo proceso del servidor, confinado solo por workdir —
  suficiente para empezar, no para producción con múltiples usuarios)
- Rate limiting por IP/token
- Rotación de `PROXY_TOKEN`

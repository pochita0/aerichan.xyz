import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_BACKEND_CWD = '/Users/jong-geon/Desktop/arbi/backend'
const DEFAULT_FRONTEND_CWD = '/Users/jong-geon/Desktop/arbi/frontend'
const DEFAULT_BACKEND_PORT = 4000
const DEFAULT_FRONTEND_PORT = 3000

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const sendJson = (res: import('http').ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const isPortOpen = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' })

    const done = (result: boolean) => {
      if (!socket.destroyed) socket.destroy()
      resolve(result)
    }

    socket.setTimeout(800)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })

const startNpmDev = (cwd: string) => {
  const child = spawn('npm', ['run', 'dev'], {
    cwd,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

const localServiceStarterPlugin = (): Plugin => {
  let booting = false

  return {
    name: 'local-service-starter',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__local/start-services')) {
          next()
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method not allowed' })
          return
        }

        if (booting) {
          sendJson(res, 409, { ok: false, error: 'Service startup already in progress' })
          return
        }

        booting = true

        try {
          const backendCwd = process.env.ARBI_BACKEND_CWD || DEFAULT_BACKEND_CWD
          const frontendCwd = process.env.ARBI_FRONTEND_CWD || DEFAULT_FRONTEND_CWD
          const backendPort = Number(process.env.ARBI_BACKEND_PORT || DEFAULT_BACKEND_PORT)
          const frontendPort = Number(process.env.ARBI_FRONTEND_PORT || DEFAULT_FRONTEND_PORT)

          const backend = {
            running: false,
            started: false,
            port: backendPort,
            cwd: backendCwd,
            error: undefined as string | undefined,
          }

          const frontend = {
            running: false,
            started: false,
            port: frontendPort,
            cwd: frontendCwd,
            error: undefined as string | undefined,
          }

          if (!fs.existsSync(backendCwd)) {
            backend.error = `backend cwd not found: ${backendCwd}`
          } else {
            backend.running = await isPortOpen(backendPort)
            if (!backend.running) {
              startNpmDev(backendCwd)
              backend.started = true
            }
          }

          if (!fs.existsSync(frontendCwd)) {
            frontend.error = `frontend cwd not found: ${frontendCwd}`
          } else {
            frontend.running = await isPortOpen(frontendPort)
            if (!frontend.running) {
              startNpmDev(frontendCwd)
              frontend.started = true
            }
          }

          await delay(1200)
          if (!backend.error) {
            backend.running = await isPortOpen(backendPort)
          }
          if (!frontend.error) {
            frontend.running = await isPortOpen(frontendPort)
          }

          const hasErrors = Boolean(backend.error || frontend.error)
          const ok = !hasErrors && backend.running && frontend.running

          sendJson(res, ok ? 200 : 500, {
            ok,
            backend,
            frontend,
            error: ok ? undefined : 'Some local services failed to start',
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown startup error'
          sendJson(res, 500, { ok: false, error: message })
        } finally {
          booting = false
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localServiceStarterPlugin()],
  server: {
    proxy: {
      '/api/kakao': {
        target: 'https://dapi.kakao.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kakao/, ''),
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            proxyReq.setHeader('Origin', 'https://dapi.kakao.com');
            proxyReq.removeHeader('Referer');
          });
        },
      },
    },
  },
})

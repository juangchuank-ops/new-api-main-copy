import path from 'path'
import fs from 'node:fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const semiUiDir = path.resolve(
  path.dirname(require.resolve('@douyinfe/semi-ui')),
  '../..',
)
// Resolve @visactor vrender packages through the vchart dependency tree.
// Dedupe @visactor/vrender-core and vrender-kits so that @visactor/vchart
// and @visactor/react-vchart share the same module instance (same DI
// container).  Without this, each package brings its own copy of
// vrender-core with a separate `container` singleton; registerBrowserEnv()
// registers the browser env into one container while <VChart> reads from
// the other, causing:
//   TypeError: Cannot read properties of undefined (reading 'createCanvas')
//   TypeError: Cannot read properties of undefined (reading 'filter')
//
// Resolve vrender-core/kits from vchart's package directory so the lookup
// works across package managers (pnpm .pnpm store and bun nested
// node_modules layouts) instead of hardcoding a pnpm-only path layout.
const vchartPkgDir = path.dirname(
  require.resolve('@visactor/vchart/package.json'),
)
const resolvePkgDir = (name: string, fromDir: string): string => {
  const entry = require.resolve(name, { paths: [fromDir] })
  let dir = path.dirname(entry)
  for (let i = 0; i < 10; i++) {
    const pkgJson = path.join(dir, 'package.json')
    if (fs.existsSync(pkgJson)) {
      try {
        const meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
        if (meta.name === name) return dir
      } catch {
        // ignore malformed package.json and keep walking up
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Could not locate package directory for ${name}`)
}
const vrenderCoreDir = resolvePkgDir('@visactor/vrender-core', vchartPkgDir)
const vrenderKitsDir = resolvePkgDir('@visactor/vrender-kits', vchartPkgDir)

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const clientServerUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    ''
  const proxyServerUrl =
    clientServerUrl ||
    'http://localhost:3000'
  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: proxyServerUrl, changeOrigin: true },
    ]),
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [pluginReact()],
    source: {
      entry: {
        index: './src/index.jsx',
      },
      define: {
        'import.meta.env.VITE_REACT_APP_SERVER_URL': JSON.stringify(
          clientServerUrl,
        ),
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@douyinfe/semi-ui/dist/css/semi.css': path.resolve(
          semiUiDir,
          'dist/css/semi.css',
        ),
        'date-fns': path.resolve(__dirname, 'node_modules', 'date-fns'),
        // Dedupe @visactor/vrender-core and vrender-kits so that @visactor/vchart
        // and @visactor/react-vchart share the same module instance (same DI
        // container).  Without this, each package brings its own copy of
        // vrender-core with a separate `container` singleton; registerBrowserEnv()
        // registers the browser env into one container while <VChart> reads from
        // the other, causing:
        //   TypeError: Cannot read properties of undefined (reading 'createCanvas')
        //   TypeError: Cannot read properties of undefined (reading 'filter')
        '@visactor/vrender-core': vrenderCoreDir,
        '@visactor/vrender-kits': vrenderKitsDir,
      },
    },
    html: {
      template: './index.html',
    },
    server: {
      host: '0.0.0.0',
      strictPort: true,
      proxy: devProxy,
    },
    dev: {
      hmr: true,
      client: {
        host: 'localhost',
        port: 3000,
      },
    },
    output: {
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
    },
    performance: {
      removeConsole: isProd ? ['log'] : false,
      buildCache: {
        cacheDigest: [process.env.VITE_REACT_APP_VERSION],
      },
    },
    tools: {
      rspack: {
        devServer: {
          historyApiFallback: true,
        },
        module: {
          rules: [
            {
              test: /src[\\/].*\.js$/,
              type: 'javascript/auto',
              use: [
                {
                  loader: 'builtin:swc-loader',
                  options: {
                    jsc: {
                      parser: {
                        syntax: 'ecmascript',
                        jsx: true,
                      },
                      transform: {
                        react: {
                          runtime: 'automatic',
                          development: !isProd,
                          refresh: !isProd,
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
  }
})

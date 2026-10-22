// Ejecuta Python usando el entorno virtual del proyecto, en Windows, Mac o Linux.
// Uso desde package.json:  node scripts/python.mjs manage.py runserver
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'

const raiz = path.resolve(import.meta.dirname, '..')
const enWindows = process.platform === 'win32'
const ejecutable = enWindows ? path.join('Scripts', 'python.exe') : path.join('bin', 'python')

// Busca el entorno virtual dentro del proyecto o en la carpeta de arriba
const candidatos = ['venv', '.venv', path.join('..', 'venv'), path.join('..', '.venv')]
  .map(carpeta => path.join(raiz, carpeta, ejecutable))
const python = candidatos.find(existsSync)

if (!python) {
  console.error('\n No encontré el entorno virtual (carpeta venv).')
  console.error(' Créalo con:  python -m venv venv   y luego:  npm run instalar\n')
  process.exit(1)
}

const proceso = spawn(python, process.argv.slice(2), { cwd: raiz, stdio: 'inherit' })
proceso.on('exit', codigo => process.exit(codigo ?? 0))
// Al cerrar con Ctrl + C, también se cierra Django
for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => proceso.kill(senal))

import c from "chalk"
import fs from "fs"
import p from "path"
import EventEmitter from "events"
import { pathToFileURL } from "url"

const dir = p.join(global.root, "cmd/command")

const _idCmd = def => {
  const fl = def.file || 'unknown',
        name = (def.name || 'noname')
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .join('+'),
        cmds = []
          .concat(def.cmd || [])
          .map(x => x.toLowerCase())
          .sort()
          .join('+')

  return `file=${fl}&name=${name}&cmd=${cmds}`
}

class CmdEmitter extends EventEmitter {
  on(def, listener) {
    if (typeof def !== "object" || !def.cmd || !def.run)
      return super.on(def, listener)

    const cmds = Array.isArray(def.cmd) ? def.cmd : [def.cmd]

    def.file ??= global.lastCmdUpdate?.file
    def.call ??= 0
    def.set ??= Date.now()
    def.id ??= _idCmd(def)
    def.handlers ??= new Map()

    for (const c2 of cmds) {
      const lc = c2.toLowerCase()
      const handler = async (xp, m, extra) => {
        try {
          if (def.owner && !extra.isOwner) return
          def.call += 1
          await def.run(xp, m, extra)
        } catch (e) {
          err(c.redBright.bold(`Error ${def.name || c2}: `), e)
        }
      }
      super.on(lc, handler)
      def.handlers.set(lc, handler)
    }
    ;(this.cmd ??= []).push(def)
  }
}

export const ev = new CmdEmitter()

export const loadFile = async (f) => {
  try {
    const fp = p.join(dir, f)
    const mod = await import(pathToFileURL(fp).href + `?update=${Date.now()}`)
    const plugin = mod.default || mod
    if (typeof plugin === 'function') plugin(ev)
  } catch (e) {
    err('File error', f)
    log(e)
  }
}

export const loadAll = async () => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const files = fs.readdirSync(dir).filter(x => x.endsWith(".js"))
    for (const f of files) await loadFile(f)
    log(c.greenBright.bold(`Berhasil memuat ${ev.cmd?.length || 0} cmd`))
}

export const handleCmd = async (m, xp, store) => {
    // This will be fully implemented when index.js is refactored
}

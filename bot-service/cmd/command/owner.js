import fs from 'fs'
import path from 'path'

export default (ev) => {
  ev.on({
    cmd: ['public'],
    name: 'Public Mode',
    owner: true,
    run: async (xp, m, { chat }) => {
      global.public = true
      // Update config.json
      const configPath = path.join(global.root, 'system/set/config.json')
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      config.ownerSetting.public = true
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      
      await xp.sendMessage(chat.id, { text: '*Bot sekarang dalam mode PUBLIC (Bisa digunakan semua orang)*' }, { quoted: m })
    }
  })

  ev.on({
    cmd: ['self', 'private'],
    name: 'Self Mode',
    owner: true,
    run: async (xp, m, { chat }) => {
      global.public = false
      // Update config.json
      const configPath = path.join(global.root, 'system/set/config.json')
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      config.ownerSetting.public = false
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      
      await xp.sendMessage(chat.id, { text: '*Bot sekarang dalam mode SELF (Hanya Owner yang bisa menggunakan)*' }, { quoted: m })
    }
  })

  ev.on({
    cmd: ['eval', '>'],
    name: 'Eval JS',
    owner: true,
    run: async (xp, m, { text, chat }) => {
      if (!text) return
      try {
        let evaled = await eval(text)
        if (typeof evaled !== 'string') evaled = await import('util').then(u => u.inspect(evaled))
        await xp.sendMessage(chat.id, { text: evaled }, { quoted: m })
      } catch (e) {
        await xp.sendMessage(chat.id, { text: String(e) }, { quoted: m })
      }
    }
  })

  ev.on({
    cmd: ['addadmin'],
    name: 'Add Admin',
    owner: true,
    run: async (xp, m, { text, chat, sender }) => {
      let target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
      if (!target) return xp.sendMessage(chat.id, { text: 'Tag atau masukkan nomor target!' }, { quoted: m })
      
      const db = JSON.parse(fs.readFileSync('./user.json'))
      db[target] = db[target] || { money: 0, limit: 10, lastReset: '', status: 'User Free' }
      db[target].status = 'Admin'
      db[target].limit = 'Unlimited'
      fs.writeFileSync('./user.json', JSON.stringify(db, null, 2))
      
      await xp.sendMessage(chat.id, { text: `Berhasil menambahkan admin: @${target.split('@')[0]}`, mentions: [target] }, { quoted: m })
    }
  })

  ev.on({
    cmd: ['deladmin'],
    name: 'Remove Admin',
    owner: true,
    run: async (xp, m, { text, chat }) => {
      let target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (text ? text.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)
      if (!target) return xp.sendMessage(chat.id, { text: 'Tag atau masukkan nomor target!' }, { quoted: m })
      
      const db = JSON.parse(fs.readFileSync('./user.json'))
      if (db[target]) {
        db[target].status = 'User Free'
        db[target].limit = 10
      }
      fs.writeFileSync('./user.json', JSON.stringify(db, null, 2))
      
      await xp.sendMessage(chat.id, { text: `Berhasil menghapus admin: @${target.split('@')[0]}`, mentions: [target] }, { quoted: m })
    }
  })
}

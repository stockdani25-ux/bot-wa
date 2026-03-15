import fs from 'fs'
import path from 'path'

export default (ev) => {
  ev.on({
    cmd: ['money', 'balance', 'cekdompet'],
    name: 'Check Money',
    run: async (xp, m, { chat }) => {
      const db = global.db()
      const user = db.key[chat.id]
      if (!user) return
      let text = `*「 BALANCE 」*\n\n`
      text += `• Nama: ${user.name}\n`
      text += `• Money: Rp ${user.moneyDb.money.toLocaleString('id-ID')}\n`
      text += `• Bank: Rp ${user.moneyDb.moneyInBank.toLocaleString('id-ID')}\n`
      text += `• Exp: ${user.exp}`
      await xp.sendMessage(chat.id, { text }, { quoted: m })
    }
  })

  ev.on({
    cmd: ['slot', 'judi'],
    name: 'Slot Game',
    run: async (xp, m, { args, chat }) => {
      const db = global.db()
      const user = db.key[chat.id]
      const taruhan = parseInt(args[0])
      if (!taruhan || isNaN(taruhan)) return xp.sendMessage(chat.id, { text: `Contoh: .slot 1000` }, { quoted: m })
      if (user.moneyDb.money < taruhan) return xp.sendMessage(chat.id, { text: `Money kamu tidak cukup!` }, { quoted: m })

      const emojis = ['🍋', '🍎', '🍇', '🍒', '⭐']
      const a = emojis[Math.floor(Math.random() * emojis.length)]
      const b = emojis[Math.floor(Math.random() * emojis.length)]
      const c = emojis[Math.floor(Math.random() * emojis.length)]
      
      let win = false
      if (a === b && b === c) win = true
      
      user.moneyDb.money -= taruhan
      let text = `*「 SLOT 」*\n\n`
      text += `[ ${a} | ${b} | ${c} ]\n\n`
      
      if (win) {
        const hadiah = taruhan * 10
        user.moneyDb.money += hadiah
        text += `Selamat! Kamu menang Rp ${hadiah.toLocaleString('id-ID')}`
      } else {
        text += `Kamu kalah! Saldo kamu berkurang Rp ${taruhan.toLocaleString('id-ID')}`
      }
      
      fs.writeFileSync(path.join(global.root, 'system/db/user.json'), JSON.stringify(db, null, 2))
      await xp.sendMessage(chat.id, { text }, { quoted: m })
    }
  })

  ev.on({
    cmd: ['rob', 'rampok'],
    name: 'Robbery Game',
    run: async (xp, m, { chat }) => {
        const db = global.db()
        const user = db.key[chat.id]
        if (user.moneyDb.money < 100) return xp.sendMessage(chat.id, { text: `Butuh minimal Rp 100 untuk merampok` }, { quoted: m })
        
        const chance = Math.random()
        if (chance > 0.5) {
            const hasil = Math.floor(Math.random() * 500) + 100
            user.moneyDb.money += hasil
            await xp.sendMessage(chat.id, { text: `Berhasil merampok dan mendapat Rp ${hasil.toLocaleString('id-ID')}!` }, { quoted: m })
        } else {
            const denda = 50
            user.moneyDb.money -= denda
            await xp.sendMessage(chat.id, { text: `Gagal merampok! Kamu didenda Rp ${denda.toLocaleString('id-ID')}` }, { quoted: m })
        }
        fs.writeFileSync(path.join(global.root, 'system/db/user.json'), JSON.stringify(db, null, 2))
    }
  })
}

import fs from 'fs'

export default (ev) => {
  ev.on({
    cmd: ['antilink'],
    name: 'Anti Link',
    run: async (xp, m, { args, chat, isOwner }) => {
      if (!chat.group) return xp.sendMessage(chat.id, { text: 'Hanya untuk grup!' }, { quoted: m })
      
      const gcData = global.getGc(chat)
      if (!gcData) return
      
      const input = args[0]?.toLowerCase()
      if (input === 'on') {
        gcData.filter.antilink = true
        await xp.sendMessage(chat.id, { text: '*Anti-Link diaktifkan*' }, { quoted: m })
      } else if (input === 'off') {
        gcData.filter.antilink = false
        await xp.sendMessage(chat.id, { text: '*Anti-Link dimatikan*' }, { quoted: m })
      } else {
        await xp.sendMessage(chat.id, { text: `Gunakan: .antilink on/off\nStatus: ${gcData.filter.antilink ? 'Aktif' : 'Mati'}` }, { quoted: m })
      }
      
      // Persistence
      const groupDbPath = 'system/db/group.json'
      const db = JSON.parse(fs.readFileSync(groupDbPath, 'utf-8'))
      db.key[chat.id] = gcData
      fs.writeFileSync(groupDbPath, JSON.stringify(db, null, 2))
    }
  })

  ev.on({
    cmd: ['giveaway'],
    name: 'Giveaway',
    run: async (xp, m, { chat, isOwner }) => {
      if (!chat.group) return xp.sendMessage(chat.id, { text: 'Hanya untuk grup!' }, { quoted: m })
      
      const groupMetadata = await xp.groupMetadata(chat.id)
      const participants = groupMetadata.participants
      const randomMember = participants[Math.floor(Math.random() * participants.length)]
      
      const text = `🎉 *CONGRATULATIONS!* 🎉\n\nSelamat kepada @${randomMember.id.split('@')[0]} telah memenangkan giveaway hari ini!\nSilakan hubungi owner untuk klaim hadiah.`
      await xp.sendMessage(chat.id, { text, mentions: [randomMember.id] }, { quoted: msg })
    }
  })
}

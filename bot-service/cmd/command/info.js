export default (ev) => {
  ev.on({
    cmd: ['ping', 'p'],
    name: 'Ping',
    run: async (xp, m, { chat }) => {
      const start = Date.now()
      await xp.sendMessage(chat.id, { text: 'Testing speed...' }, { quoted: m })
      const speed = Date.now() - start
      await xp.sendMessage(chat.id, { text: `Pong! Speed: ${speed}ms` }, { quoted: m })
    }
  })

  ev.on({
    cmd: ['owner'],
    name: 'Owner Info',
    run: async (xp, m, { chat }) => {
      const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + 'FN:' + global.ownerName + '\n' + 'TEL;type=CELL;type=VOICE;waid=' + global.ownerNumber[0] + ':+' + global.ownerNumber[0] + '\n' + 'END:VCARD'
      await xp.sendMessage(chat.id, { contacts: { displayName: global.ownerName, contacts: [{ vcard }] } })
    }
  })

  ev.on({
    cmd: ['menu', 'help', 'allmenu', 'command'],
    name: 'Main Menu',
    run: async (xp, m, { chat, prefix }) => {
      let text = `*「 ${global.botName} MENU 」*\n\n`
      text += `*DOWNLOADER*\n`
      text += `• ${prefix}ig\n`
      text += `• ${prefix}ytmp4\n`
      text += `• ${prefix}ytmp3\n`
      text += `• ${prefix}fb\n`
      text += `• ${prefix}pin\n\n`
      text += `*AI FEATURES*\n`
      text += `• ${prefix}ai\n`
      text += `• ${prefix}blackbox\n\n`
      text += `*MAKER / STICKER*\n`
      text += `• ${prefix}s (image/video)\n`
      text += `• ${prefix}brat <text>\n`
      text += `• ${prefix}qc <text>\n\n`
      text += `*GROUP MENU*\n`
      text += `• ${prefix}antilink on/off\n\n`
      text += `*ECONOMY & GAMES*\n`
      text += `• ${prefix}money\n`
      text += `• ${prefix}slot\n`
      text += `• ${prefix}rob\n\n`
      text += `*UTILITY*\n`
      text += `• ${prefix}ping\n`
      text += `• ${prefix}owner\n`
      text += `• ${prefix}public / self (Owner)\n`
      await xp.sendMessage(chat.id, {
        text,
        contextInfo: {
          externalAdReply: {
            title: global.botFullName,
            body: global.footer,
            thumbnailUrl: global.thumbnail,
            sourceUrl: global.idCh,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: m })
    }
  })
}

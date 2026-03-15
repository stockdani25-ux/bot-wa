import axios from 'axios'
import { Sticker, createSticker, StickerTypes } from 'wa-sticker-formatter'

export default (ev) => {
  ev.on({
    cmd: ['s', 'sticker', 'stiker'],
    name: 'Sticker Maker',
    run: async (xp, m, { chat }) => {
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const msg = m.message?.imageMessage || m.message?.videoMessage || quoted?.imageMessage || quoted?.videoMessage
      
      if (!msg) return xp.sendMessage(chat.id, { text: 'Kirim/reply gambar atau video untuk dijadikan stiker' }, { quoted: m })
      
      await xp.sendMessage(chat.id, { react: { text: "⏳", key: m.key } })
      
      try {
        const buffer = await xp.downloadMediaMessage(m) // Note: This might need adjustment based on Baileys version
        const sticker = new Sticker(buffer, {
          pack: global.botName,
          author: global.ownerName,
          type: StickerTypes.FULL,
          categories: ['🤩', '🎉'],
          id: m.key.id,
          quality: 50
        })
        const sticBuffer = await sticker.toBuffer()
        await xp.sendMessage(chat.id, { sticker: sticBuffer }, { quoted: m })
      } catch (e) {
        err('Error sticker:', e)
      }
    }
  })

  ev.on({
    cmd: ['brat'],
    name: 'Brat Sticker',
    run: async (xp, m, { args, text, chat }) => {
      const txt = text || args.join(' ')
      if (!txt) return xp.sendMessage(chat.id, { text: 'Masukkan teksnya!' }, { quoted: m })
      
      await xp.sendMessage(chat.id, { react: { text: "⏳", key: m.key } })
      try {
        const url = `https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(txt)}`
        const res = await axios.get(url, { responseType: 'arraybuffer' })
        const sticker = new Sticker(res.data, {
          pack: 'Brat Sticker',
          author: global.botName,
          type: StickerTypes.FULL
        })
        await xp.sendMessage(chat.id, { sticker: await sticker.toBuffer() }, { quoted: m })
      } catch (e) { err('Error brat:', e) }
    }
  })

  ev.on({
    cmd: ['qc'],
    name: 'Quoted Chat',
    run: async (xp, m, { text, chat }) => {
      if (!text) return xp.sendMessage(chat.id, { text: 'Masukkan teksnya!' }, { quoted: m })
      
      const avatar = await xp.profilePictureUrl(m.key.participant || m.key.remoteJid, 'image').catch(() => 'https://c.termai.cc/i0/7DbG.jpg')
      const json = {
        type: 'quote',
        format: 'png',
        backgroundColor: '#FFFFFF',
        width: 512,
        height: 768,
        scale: 2,
        messages: [{
          entities: [],
          avatar: true,
          from: { id: 1, name: m.pushName || 'User', photo: { url: avatar } },
          text: text,
          replyMessage: {}
        }]
      }
      try {
        const res = await axios.post('https://bot.lyo.su/quote/generate', json)
        const buff = Buffer.from(res.data.result.image, 'base64')
        const sticker = new Sticker(buff, {
          pack: 'QC Sticker',
          author: global.botName
        })
        await xp.sendMessage(chat.id, { sticker: await sticker.toBuffer() }, { quoted: m })
      } catch (e) { err('Error qc:', e) }
    }
  })
}

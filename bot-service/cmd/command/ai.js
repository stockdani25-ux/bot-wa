import axios from 'axios'
const apiTermai = 'https://api.termai.cc'
const termaiKey = 'Bell409'

export default (ev) => {
  ev.on({
    cmd: ['ai', 'chatgpt'],
    name: 'AI Chat',
    run: async (xp, m, { text, prefix, cmd }) => {
      if (!text) return xp.sendMessage(m.key.remoteJid, { text: `Halo! Ada yang bisa saya bantu?` }, { quoted: m })
      try {
        const res = await axios.get(`${apiTermai}/api/ai/chatgpt?q=${encodeURIComponent(text)}&key=${termaiKey}`)
        if (res.data.status && res.data.data) {
            await xp.sendMessage(m.key.remoteJid, { text: res.data.data.answer }, { quoted: m })
        }
      } catch (e) { err('Error ai:', e) }
    }
  })

  ev.on({
    cmd: ['blackbox'],
    name: 'Blackbox AI',
    run: async (xp, m, { text }) => {
      if (!text) return
      try {
        const res = await axios.get(`${apiTermai}/api/ai/blackbox?q=${encodeURIComponent(text)}&key=${termaiKey}`)
        if (res.data.status && res.data.data) {
            await xp.sendMessage(m.key.remoteJid, { text: res.data.data.answer }, { quoted: m })
        }
      } catch (e) { err('Error blackbox:', e) }
    }
  })
}

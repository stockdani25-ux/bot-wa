import axios from 'axios'

const apiDanzy = 'https://api.danzy.web.id'
const apiTermai = 'https://api.termai.cc'
const apiDeline = 'https://api.deline.web.id'
const termaiKey = 'Bell409'

export default (ev) => {
  ev.on({
    cmd: ['igdl', 'ig', 'igreels'],
    name: 'Instagram Downloader',
    run: async (xp, m, { args, prefix, cmd }) => {
      if (!args[0]) return xp.sendMessage(m.key.remoteJid, { text: `Contoh: ${prefix}${cmd} https://www.instagram.com/reel/xxx/` }, { quoted: m })
      await xp.sendMessage(m.key.remoteJid, { react: { text: "⏳", key: m.key } })
      try {
        const res = await axios.get(`${apiDanzy}/api/download/instagram?url=${encodeURIComponent(args[0])}`)
        if (res.data.status && res.data.result) {
            const result = res.data.result
            const mediaUrl = result.url || result.download_url
            await xp.sendMessage(m.key.remoteJid, { video: { url: mediaUrl }, caption: `Done ✨` }, { quoted: m })
        } else {
            await xp.sendMessage(m.key.remoteJid, { text: "Gagal mengambil data dari API." }, { quoted: m })
        }
      } catch (e) {
          err('Error igdl:', e)
          await xp.sendMessage(m.key.remoteJid, { text: "Terjadi kesalahan." }, { quoted: m })
      }
    }
  })

  ev.on({
    cmd: ['ytmp4', 'ytv'],
    name: 'YouTube MP4',
    run: async (xp, m, { args, prefix, cmd }) => {
      if (!args[0]) return xp.sendMessage(m.key.remoteJid, { text: `Usage: ${prefix}${cmd} <url>` }, { quoted: m })
      await xp.sendMessage(m.key.remoteJid, { react: { text: "⏳", key: m.key } })
      try {
        const res = await axios.get(`${apiTermai}/api/downloader/youtube?type=mp4&url=${encodeURIComponent(args[0])}&key=${termaiKey}`)
        if (res.data.status && res.data.data) {
            await xp.sendMessage(m.key.remoteJid, { video: { url: res.data.data.downloads[0].dlink }, caption: res.data.data.title }, { quoted: m })
        }
      } catch (e) {
          err('Error ytmp4:', e)
      }
    }
  })

  ev.on({
    cmd: ['ytmp3', 'yta'],
    name: 'YouTube MP3',
    run: async (xp, m, { args, prefix, cmd }) => {
      if (!args[0]) return xp.sendMessage(m.key.remoteJid, { text: `Usage: ${prefix}${cmd} <url>` }, { quoted: m })
      await xp.sendMessage(m.key.remoteJid, { react: { text: "⏳", key: m.key } })
      try {
        const res = await axios.get(`${apiTermai}/api/downloader/youtube?type=mp3&url=${encodeURIComponent(args[0])}&key=${termaiKey}`)
        if (res.data.status && res.data.data) {
            await xp.sendMessage(m.key.remoteJid, { audio: { url: res.data.data.downloads[0].dlink }, mimetype: 'audio/mpeg' }, { quoted: m })
        }
      } catch (e) {
          err('Error ytmp3:', e)
      }
    }
  })
  
  ev.on({
    cmd: ['fb', 'fbdl'],
    name: 'Facebook Downloader',
    run: async (xp, m, { args, prefix, cmd }) => {
      if (!args[0]) return xp.sendMessage(m.key.remoteJid, { text: `Usage: ${prefix}${cmd} <url>` }, { quoted: m })
      try {
        const res = await axios.get(`${apiDanzy}/api/download/facebook?url=${encodeURIComponent(args[0])}`)
        if (res.data.status && res.data.data) {
            const videoUrl = res.data.data.hd || res.data.data.sd
            await xp.sendMessage(m.key.remoteJid, { video: { url: videoUrl }, caption: res.data.data.title }, { quoted: m })
        }
      } catch (e) { err('Error fb:', e) }
    }
  })

  ev.on({
    cmd: ['pin', 'pindl'],
    name: 'Pinterest Downloader',
    run: async (xp, m, { args, prefix, cmd }) => {
      if (!args[0]) return xp.sendMessage(m.key.remoteJid, { text: `Usage: ${prefix}${cmd} <url>` }, { quoted: m })
      try {
        const res = await axios.get(`${apiDeline}/downloader/pinterest?url=${encodeURIComponent(args[0])}`)
        if (res.data.status && res.data.result) {
            const mediaUrl = res.data.result.video || res.data.result.image
            if (res.data.result.video && res.data.result.video !== "Tidak ada") {
                await xp.sendMessage(m.key.remoteJid, { video: { url: mediaUrl } }, { quoted: m })
            } else {
                await xp.sendMessage(m.key.remoteJid, { image: { url: mediaUrl } }, { quoted: m })
            }
        }
      } catch (e) { err('Error pin:', e) }
    }
  })
}

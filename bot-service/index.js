const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    downloadMediaMessage
} = require("@whiskeysockets/baileys");
const fs = require('fs-extra');
const pino = require('pino');
const path = require('path');
const axios = require('axios');
const { performance } = require('perf_hooks');
const moment = require('moment-timezone');
const readline = require('readline');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
require('dotenv').config();

// Game Sessions
const gameSessions = {};

// Bot Configuration
const botConfig = {
    name: "DABI-BOT",
    owner: ["6282115160898", "70510847213690"],
    prefix: ".",
    public: true
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// DB Helpers
const dbPath = './user.json';
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));

function getDb() {
    return JSON.parse(fs.readFileSync(dbPath));
}

function saveDb(db) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    // Pairing Code Setup
    if (!state.creds?.me?.id) {
        console.log('\x1b[36m%s\x1b[0m', '\n--- SETUP PAIRING CODE ---');
        let phoneNumber = await question('Masukkan Nomor WhatsApp (contoh: 628xxx): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log('\x1b[32m%s\x1b[0m', `\nKODE PAIRING ANDA: ${code}`);
                } catch (e) {
                    console.error('Gagal mendapatkan pairing code:', e);
                }
            }, 3000);
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('\x1b[31m%s\x1b[0m', 'Connection closed: Logged Out. Please delete the session folder and restart to login again.');
            } else {
                console.log(`Connection closed (Status: ${statusCode || 'unknown'}). Reconnecting...`);
                startBot();
            }
        } else if (connection === 'open') {
            const jid = jidDecode(sock.user.id).user + '@s.whatsapp.net';
            const pushname = sock.user.name || 'Bot';
            console.log('\x1b[32m%s\x1b[0m', `Bot connected successfully as ${pushname} (${jid})`);

            // Save Login to DB
            const db = getDb();
            db.login_history = db.login_history || [];
            db.login_history.push({
                jid,
                pushname,
                time: moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss'),
                browser: ['Ubuntu', 'Chrome', '20.0.04']
            });
            saveDb(db);
        }
    });

    sock.ev.on('messages.upsert', async m => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const sender = msg.key.participant || from;
            const pushname = msg.pushName || "User";
            const type = Object.keys(msg.message)[0];

            const body = (type === 'conversation') ? msg.message.conversation :
                (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text :
                    (type === 'imageMessage') ? msg.message.imageMessage.caption :
                        (type === 'videoMessage') ? msg.message.videoMessage.caption :
                            (type === 'templateButtonReplyMessage') ? msg.message.templateButtonReplyMessage.selectedId :
                                (type === 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage.selectedButtonId :
                                    (type === 'listResponseMessage') ? msg.message.listResponseMessage.singleSelectReply.selectedRowId : '';

            const isCmd = body.startsWith(botConfig.prefix);
            const command = isCmd ? body.slice(botConfig.prefix.length).trim().split(' ')[0].toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(' ');

            // Log All Messages (for debugging)
            console.log(`\x1b[33m[CHAT]\x1b[0m ${pushname} (${from}): ${body}`);

            if (isCmd) console.log(`\x1b[36m[CMD]\x1b[0m ${pushname} (${from}): ${body}`);

            const senderNum = sender.split('@')[0];

            // AFK Tag Detection
            const dbAfkTag = getDb();
            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            for (let jid of mentioned) {
                if (dbAfkTag[jid]?.afk) {
                    const data = dbAfkTag[jid].afk;
                    await sock.sendMessage(from, { text: `Target sedang AFK!\nAlasan: ${data.reason}\nSejak: ${moment(data.time).fromNow()}` }, { quoted: msg });
                }
            }

            // Handle Active Games (No Prefix Required)
            if (gameSessions[from]) {
                const session = gameSessions[from];
                const strip = (str) => str.trim().toLowerCase().replace(/[^\w\s]/g, '');
                
                const userAns = strip(body);
                const userAnsNoPrefix = isCmd ? strip(body.slice(botConfig.prefix.length)) : userAns;
                
                const answers = Array.isArray(session.answer) ? session.answer : [session.answer];
                console.log(`\x1b[34m[GAME DEBUG]\x1b[0m Checking: "${userAns}" against [${answers.join(', ')}]`);

                const isMatch = answers.some(ans => {
                    const cleanAns = strip(ans);
                    return userAns === cleanAns || userAnsNoPrefix === cleanAns;
                });

                if (isMatch) {
                    const dbGame = getDb();
                    dbGame[sender] = dbGame[sender] || { money: 1000, limit: 10, status: 'User Free' };
                    dbGame[sender].money = (dbGame[sender].money || 0) + 2000;
                    saveDb(dbGame);
                    await sock.sendMessage(from, { text: `🎉 *SELAMAT!* Jawaban kamu benar!\nKamu mendapatkan Rp 2.000!` }, { quoted: msg });
                    if (session.timeout) clearTimeout(session.timeout);
                    delete gameSessions[from];
                    return;
                } else if (!isCmd && userAns.length > 0) {
                    // Only send "Salah" if it's not a command to avoid spam
                    await sock.sendMessage(from, { text: '❌ *SALAH!* Coba lagi.' }, { quoted: msg });
                }
            }

            // Database & Limit Initialization
            const db = getDb();
            const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
            
            if (!db[sender]) {
                db[sender] = {
                    money: 0,
                    limit: 10,
                    lastReset: today,
                    status: 'User Free'
                };
            }

            // Daily Limit Reset
            if (db[sender].lastReset !== today) {
                db[sender].limit = 10;
                db[sender].lastReset = today;
            }
            saveDb(db);

            const user = db[sender];
            const isOwner = botConfig.owner.includes(senderNum);
            const isAdmin = user.status === 'Admin' || user.status === 'Owner' || isOwner;

            if (isCmd) {
                if (!botConfig.public && !isOwner) return;

                // Clear AFK if user speaks
                const dbAfkCheck = getDb();
                if (dbAfkCheck[sender]?.afk) {
                    delete dbAfkCheck[sender].afk;
                    saveDb(dbAfkCheck);
                    await sock.sendMessage(from, { text: `Selamat datang kembali ${pushname}! AFK kamu telah dimatikan.` }, { quoted: msg });
                }

                console.log(`[CMD] ${pushname}: ${botConfig.prefix}${command}`);

                // Check Limit (Excluded commands and Games)
                const freeCmds = ['menu', 'help', 'allmenu', 'profile', 'limit', 'owner', 'claim', 'tebakkartun', 'tebakkata', 'tebakbendera', 'tebakhewan', 'tebakjkt', 'tebaktebakan', 'family100', 'tebakgambar', 'caklontong', 'tekateki', 'asahotak', 'susunkata', 'tebaklagu', 'tebakgame', 'tebaklogo', 'siapakahaku', 'tebakkalimat', 'lengkapikalimat', 'tebakkimia', 'surah', 'tebaklirik'];
                const isGame = command.includes('tebak') || ['caklontong', 'family100', 'tekateki', 'asahotak', 'susunkata', 'siapakahaku', 'surah', 'lengkapikalimat'].some(g => command.includes(g));
                
                if (!freeCmds.includes(command) && !isGame && !isAdmin) {
                    if (user.limit <= 0) return sock.sendMessage(from, { text: `Limit harian kamu habis! Limit akan reset setiap hari.\nBeli premium untuk Unlimited Limit.` }, { quoted: msg });
                    user.limit -= 1;
                    saveDb(db);
                }

                switch (command) {
                    case 'menu':
                    case 'help':
                    case 'allmenu':
                        const dbMenu = getDb();
                        const userMenu = dbMenu[sender] || { money: 1000, limit: 'Unlimited', status: 'User Free' };
                        const timeNow = moment().tz('Asia/Jakarta');

                        const menuText = `*「 ALL MENU - DEMN BOT 」*

👤 *User* : ${pushname}
🏅 *Status* : ${isOwner ? 'Owner' : userMenu.status}
💰 *Balance* : Rp ${userMenu.money.toLocaleString()}
🎫 *Limit* : ${userMenu.limit || 'Unlimited'}

📅 *Hari* : ${timeNow.format('dddd')}
📆 *Tanggal* : ${timeNow.format('DD MMMM YYYY')}
⌚ *Waktu* : ${timeNow.format('HH.mm.ss')}

*「 MAIN MENU 」*
⏧ ${botConfig.prefix}profile
⏧ ${botConfig.prefix}claim
⏧ ${botConfig.prefix}transfer
⏧ ${botConfig.prefix}leaderboard
⏧ ${botConfig.prefix}request
⏧ ${botConfig.prefix}react
⏧ ${botConfig.prefix}tagme
⏧ ${botConfig.prefix}runtime
⏧ ${botConfig.prefix}ping
⏧ ${botConfig.prefix}afk
⏧ ${botConfig.prefix}menfes
⏧ ${botConfig.prefix}confes
⏧ ${botConfig.prefix}roomai
⏧ ${botConfig.prefix}jadibot
⏧ ${botConfig.prefix}donasi

*「 GROUP MENU 」*
⏧ ${botConfig.prefix}add
⏧ ${botConfig.prefix}kick
⏧ ${botConfig.prefix}promote
⏧ ${botConfig.prefix}demote
⏧ ${botConfig.prefix}setdesc
⏧ ${botConfig.prefix}linkgrup
⏧ ${botConfig.prefix}tagall
⏧ ${botConfig.prefix}hidetag
⏧ ${botConfig.prefix}setnamegc
⏧ ${botConfig.prefix}setdescgc
⏧ ${botConfig.prefix}revoke
⏧ ${botConfig.prefix}setppgc

*「 ROOM AI MENU 」*
⏧ ${botConfig.prefix}roomai <model>
⏧ ${botConfig.prefix}delroomai
⏧ Models: kuroneko, metaai, wormgpt, gemini-lite

*「 AI MENU 」*
⏧ ${botConfig.prefix}bypass
⏧ ${botConfig.prefix}mathgpt
⏧ ${botConfig.prefix}perplexed
⏧ ${botConfig.prefix}gemini
⏧ ${botConfig.prefix}deepimg
⏧ ${botConfig.prefix}editimg
⏧ ${botConfig.prefix}nsfwgen

*「 MAKER MENU 」*
⏧ ${botConfig.prefix}sticker
⏧ ${botConfig.prefix}brat
⏧ ${botConfig.prefix}qc
⏧ ${botConfig.prefix}ephoto
⏧ ${botConfig.prefix}blurface
⏧ ${botConfig.prefix}removebg
⏧ ${botConfig.prefix}deepnude

*「 DOWNLOADER 」*
⏧ ${botConfig.prefix}tiktokmp4
⏧ ${botConfig.prefix}tiktokmp3
⏧ ${botConfig.prefix}ytmp4
⏧ ${botConfig.prefix}ytmp3
⏧ ${botConfig.prefix}igdl / .igdownload
⏧ ${botConfig.prefix}spotify

*「 RANDOM MENU 」*
⏧ ${botConfig.prefix}waifu
⏧ ${botConfig.prefix}blue-archive
⏧ ${botConfig.prefix}neko
⏧ ${botConfig.prefix}quotesanime

*「 SEARCH MENU 」*
⏧ ${botConfig.prefix}yts
⏧ ${botConfig.prefix}tiktok
⏧ ${botConfig.prefix}pinterest
⏧ ${botConfig.prefix}lyrics

*「 CANVAS MENU 」*
⏧ ${botConfig.prefix}blur (reply/kirim foto)
⏧ ${botConfig.prefix}facepalm (reply/kirim foto)
⏧ ${botConfig.prefix}tolol <nama>

*「 GAME MENU 」*
⏧ ${botConfig.prefix}tebakkartun
⏧ ${botConfig.prefix}tebakkata
⏧ ${botConfig.prefix}tebakbendera
⏧ ${botConfig.prefix}tebakhewan
⏧ ${botConfig.prefix}tebakjkt
⏧ ${botConfig.prefix}tebaktebakan
⏧ ${botConfig.prefix}family100
⏧ ${botConfig.prefix}tebakgambar
⏧ ${botConfig.prefix}caklontong
⏧ ${botConfig.prefix}tekateki
⏧ ${botConfig.prefix}asahotak
⏧ ${botConfig.prefix}susunkata
⏧ ${botConfig.prefix}tebaklagu
⏧ ${botConfig.prefix}tebakgame
⏧ ${botConfig.prefix}tebaklogo
⏧ ${botConfig.prefix}siapakahaku

*「 NEWS MENU 」*
⏧ ${botConfig.prefix}cnbc
⏧ ${botConfig.prefix}suara
⏧ ${botConfig.prefix}liputan6
⏧ ${botConfig.prefix}tribun
⏧ ${botConfig.prefix}sindonews
⏧ ${botConfig.prefix}kompas
⏧ ${botConfig.prefix}merdeka
⏧ ${botConfig.prefix}cnn
⏧ ${botConfig.prefix}jkt48
⏧ ${botConfig.prefix}antara

*「 TOOLS & INFO 」*
⏧ ${botConfig.prefix}owner
⏧ ${botConfig.prefix}sc
⏧ ${botConfig.prefix}restart (Owner)
⏧ ${botConfig.prefix}stop (Owner)

*Note:* Gunakan prefix ${botConfig.prefix} sebelum memanggil command.`;
                        await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                        break;

                    case 'profile':
                        const dbProf = getDb();
                        const userProf = dbProf[sender] || { money: 1000, limit: 'Unlimited', status: 'User Free' };
                        const profText = `*「 USER PROFILE 」*
                        
👤 *User* : ${pushname}
🏅 *Status* : ${isOwner ? 'Owner' : userProf.status}
💰 *Balance* : Rp ${userProf.money.toLocaleString()}
🎫 *Limit* : ${userProf.limit || 'Unlimited'}
📱 *Number* : ${senderNum}`;
                        await sock.sendMessage(from, { text: profText }, { quoted: msg });
                        break;

                    case 'sticker':
                    case 's':
                        const quotedStic = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        const msgStic = msg.message?.imageMessage || msg.message?.videoMessage || quotedStic?.imageMessage || quotedStic?.videoMessage;

                        if (!msgStic) return sock.sendMessage(from, { text: `Kirim/reply gambar atau video dengan caption ${botConfig.prefix}${command}` }, { quoted: msg });

                        try {
                            const buffer = await downloadMediaMessage(msg, 'buffer', {});
                            const sticker = new Sticker(buffer, {
                                pack: botConfig.name,
                                author: pushname,
                                type: StickerTypes.FULL,
                                quality: 50
                            });
                            await sock.sendMessage(from, { sticker: await sticker.toBuffer() }, { quoted: msg });
                        } catch (e) {
                            console.error(e);
                            await sock.sendMessage(from, { text: 'Gagal membuat stiker.' });
                        }
                        break;

                    case 'brat':
                        if (!text) return sock.sendMessage(from, { text: 'Masukkan teksnya!' });
                        try {
                            const resBrat = await axios.get(`https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(text)}`, { responseType: 'arraybuffer' });
                            const sticBrat = new Sticker(resBrat.data, {
                                pack: 'Brat Sticker',
                                author: botConfig.name,
                                type: StickerTypes.FULL
                            });
                            await sock.sendMessage(from, { sticker: await sticBrat.toBuffer() }, { quoted: msg });
                        } catch (e) { console.error(e); }
                        break;

                    case 'qc':
                        if (!text) return sock.sendMessage(from, { text: 'Masukkan teksnya!' });
                        try {
                            const avatar = await sock.profilePictureUrl(sender, 'image').catch(() => 'https://c.termai.cc/i0/7DbG.jpg');
                            const jsonQc = {
                                type: 'quote',
                                format: 'png',
                                backgroundColor: '#FFFFFF',
                                width: 512,
                                height: 768,
                                scale: 2,
                                messages: [{
                                    entities: [],
                                    avatar: true,
                                    from: { id: 1, name: pushname, photo: { url: avatar } },
                                    text: text,
                                    replyMessage: {}
                                }]
                            };
                            const resQc = await axios.post('https://bot.lyo.su/quote/generate', jsonQc);
                            const buffQc = Buffer.from(resQc.data.result.image, 'base64');
                            const sticQc = new Sticker(buffQc, {
                                pack: 'QC Sticker',
                                author: botConfig.name
                            });
                            await sock.sendMessage(from, { sticker: await sticQc.toBuffer() }, { quoted: msg });
                        } catch (e) { console.error(e); }
                        break;

                    case 'ephoto':
                        if (!text) return sock.sendMessage(from, { text: 'Masukkan teksnya!' });
                        try {
                            // Using standard termai ephoto endpoint
                            const resEp = await axios.get(`https://api.termai.cc/api/maker/ephoto?text=${encodeURIComponent(text)}&key=dabi-ai`);
                            if (resEp.data.status) {
                                await sock.sendMessage(from, { image: { url: resEp.data.url }, caption: 'Hasil Ephoto' }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'blurface':
                    case 'removebg':
                    case 'deepnude':
                        const qMaker = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        const imgMaker = msg.message?.imageMessage || qMaker?.imageMessage;
                        if (!imgMaker) return sock.sendMessage(from, { text: 'Reply atau kirim gambar.' });
                        try {
                            const bufMaker = await downloadMediaMessage(msg, 'buffer', {});
                            const form = new (require('form-data'))();
                            form.append('file', bufMaker, { filename: 'image.jpg' });
                            const resMaker = await axios.post(`https://api.termai.cc/api/tools/${command}?key=dabi-ai`, form, { headers: form.getHeaders() });
                            if (resMaker.data.status) {
                                await sock.sendMessage(from, { image: { url: resMaker.data.url }, caption: `Hasil ${command}` }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'toimg':
                        const qToImg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        const sticToImg = qToImg?.stickerMessage;
                        if (!sticToImg) return sock.sendMessage(from, { text: 'Reply stiker yang mau dijadikan gambar.' });
                        try {
                            const bufStic = await downloadMediaMessage({ message: qToImg }, 'buffer', {});
                            const { exec } = require('child_process');
                            const tmpPath = path.join(__dirname, 'temp');
                            if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
                            const inPath = path.join(tmpPath, `${Date.now()}.webp`);
                            const outPath = path.join(tmpPath, `${Date.now()}.png`);
                            fs.writeFileSync(inPath, bufStic);
                            exec(`ffmpeg -i ${inPath} ${outPath}`, async (errFfmpeg) => {
                                if (errFfmpeg) return sock.sendMessage(from, { text: 'Gagal konversi stiker.' });
                                await sock.sendMessage(from, { image: fs.readFileSync(outPath), caption: 'Ini gambarnya.' }, { quoted: msg });
                                if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
                                if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
                            });
                        } catch (e) { console.error(e); }
                        break;

                    case 'tiktok':
                    case 'tiktokmp4':
                    case 'tt':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Masukkan link atau query pencarian.' });
                        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
                        try {
                            const isUrl = args[0].includes('http');
                            if (isUrl) {
                                const res = await axios.get(`https://api.danzy.web.id/api/download/tiktok?url=${encodeURIComponent(args[0])}`);
                                if (res.data.status && res.data.result) {
                                    await sock.sendMessage(from, { video: { url: res.data.result.video }, caption: res.data.result.title || 'Done ✨' }, { quoted: msg });
                                }
                            } else {
                                const resSearch = await axios.get(`https://api.danzy.web.id/api/search/tiktok?q=${encodeURIComponent(text)}`);
                                if (resSearch.data.status && resSearch.data.result.length > 0) {
                                    const top = resSearch.data.result[0];
                                    await sock.sendMessage(from, { video: { url: top.video }, caption: `*TIKTOK SEARCH*\nTitle: ${top.title}\nAuthor: ${top.author}` }, { quoted: msg });
                                }
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'spotify':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Mana linknya?' });
                        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
                        try {
                            const res = await axios.get(`https://api.danzy.web.id/api/download/spotify?url=${encodeURIComponent(args[0])}`);
                            if (res.data.status && res.data.data) {
                                const result = res.data.data;
                                const buffer = (await axios.get(result.download, { responseType: 'arraybuffer' })).data;
                                await sock.sendMessage(from, {
                                    audio: buffer,
                                    mimetype: 'audio/mpeg',
                                    contextInfo: {
                                        externalAdReply: {
                                            title: result.title,
                                            body: result.artist,
                                            thumbnailUrl: result.image,
                                            mediaType: 2,
                                            mediaUrl: args[0],
                                            sourceUrl: args[0]
                                        }
                                    }
                                }, { quoted: msg })
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'ig':
                    case 'igdl':
                    case 'igdownload':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Mana linknya?' });
                        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
                        try {
                            const res = await axios.get(`https://api.danzy.web.id/api/download/instagram?url=${encodeURIComponent(args[0])}`);
                            if (res.data.status && res.data.result) {
                                await sock.sendMessage(from, { video: { url: res.data.result.url || res.data.result.download_url }, caption: 'Done ✨' }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'yts':
                        if (!text) return sock.sendMessage(from, { text: 'Mau cari apa di YouTube?' });
                        try {
                            const yts = require('yt-search');
                            const search = await yts(text);
                            const list = search.all.slice(0, 10);
                            let ytsText = `*「 YOUTUBE SEARCH 」*\n\n`;
                            list.forEach((v, i) => {
                                ytsText += `${i + 1}. *${v.title}*\n• URL: ${v.url}\n• Durasi: ${v.timestamp}\n\n`;
                            });
                            await sock.sendMessage(from, { text: ytsText }, { quoted: msg });
                        } catch (e) { console.error(e); }
                        break;

                    case 'fb':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Mana linknya?' });
                        try {
                            const res = await axios.get(`https://api.danzy.web.id/api/download/facebook?url=${encodeURIComponent(args[0])}`);
                            if (res.data.status && res.data.data) {
                                await sock.sendMessage(from, { video: { url: res.data.data.hd || res.data.data.sd } }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'pin':
                    case 'pinterest':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Masukkan link atau query pencarian.' });
                        try {
                            const isUrlP = args[0].includes('http');
                            if (isUrlP) {
                                const res = await axios.get(`https://api.deline.web.id/downloader/pinterest?url=${encodeURIComponent(args[0])}`);
                                if (res.data.status && res.data.result) {
                                    const mediaUrl = res.data.result.video || res.data.result.image;
                                    if (res.data.result.video && res.data.result.video !== "Tidak ada") {
                                        await sock.sendMessage(from, { video: { url: mediaUrl } }, { quoted: msg });
                                    } else {
                                        await sock.sendMessage(from, { image: { url: mediaUrl } }, { quoted: msg });
                                    }
                                }
                            } else {
                                const resSP = await axios.get(`https://api.danzy.web.id/api/search/pinterest?q=${encodeURIComponent(text)}`);
                                if (resSP.data.status && resSP.data.result.length > 0) {
                                    const topP = resSP.data.result[0];
                                    await sock.sendMessage(from, { image: { url: topP.image } }, { quoted: msg });
                                }
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'lyrics':
                    case 'lirik':
                        if (!text) return sock.sendMessage(from, { text: 'Lagu apa yang mau dicari liriknya?' });
                        try {
                            const resL = await axios.get(`https://api.danzy.web.id/api/search/lyrics?q=${encodeURIComponent(text)}`);
                            if (resL.data.status && resL.data.result.length > 0) {
                                const lirik = resL.data.result[0];
                                await sock.sendMessage(from, { text: `*${lirik.trackName}* - ${lirik.artistName}\n\n${lirik.lyrics}` }, { quoted: msg });
                            } else {
                                await sock.sendMessage(from, { text: 'Lirik tidak ditemukan.' });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'waifu':
                    case 'neko':
                    case 'blue-archive':
                        try {
                            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
                            const resRandom = await axios.get(`https://api.danzy.web.id/api/random/${command}`, { responseType: 'arraybuffer' });
                            await sock.sendMessage(from, { image: resRandom.data, caption: `Random ${command}` }, { quoted: msg });
                        } catch (e) {
                            console.error(e);
                            await sock.sendMessage(from, { text: `Gagal mengambil ${command}` });
                        }
                        break;

                    case 'quotesanime':
                        try {
                            const resQ = await axios.get(`https://api.danzy.web.id/api/random/quotesanime`);
                            if (resQ.data.status && resQ.data.result) {
                                const q = resQ.data.result;
                                await sock.sendMessage(from, { text: `"${q.quote}"\n\n- ${q.character} (${q.anime})` }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'add':
                    case 'kick':
                    case 'promote':
                    case 'demote':
                        if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: 'Hanya bisa di grup.' });
                        if (!isOwner) return sock.sendMessage(from, { text: 'Hanya untuk owner/admin (untuk saat ini hanya owner).' });
                        const userAction = m.messages[0].message?.extendedTextMessage?.contextInfo?.participant || args[0]?.replace('@', '') + '@s.whatsapp.net';
                        if (!userAction) return sock.sendMessage(from, { text: 'Tag atau sebut nomor target.' });
                        try {
                            if (command === 'add') await sock.groupParticipantsUpdate(from, [userAction], 'add');
                            if (command === 'kick') await sock.groupParticipantsUpdate(from, [userAction], 'remove');
                            if (command === 'promote') await sock.groupParticipantsUpdate(from, [userAction], 'promote');
                            if (command === 'demote') await sock.groupParticipantsUpdate(from, [userAction], 'demote');
                            await sock.sendMessage(from, { text: 'Sukses!' });
                        } catch (e) { console.error(e); }
                        break;

                    case 'claim':
                        const dbClaim = getDb();
                        const userClaim = dbClaim[sender] || { money: 1000, lastClaim: 0 };
                        const timeClaim = Date.now();
                        if (timeClaim - userClaim.lastClaim < 86400000) {
                            const left = 86400000 - (timeClaim - userClaim.lastClaim);
                            return sock.sendMessage(from, { text: `Tunggu ${Math.floor(left / 3600000)} jam lagi.` }, { quoted: msg });
                        }
                        userClaim.money += 5000;
                        userClaim.lastClaim = timeClaim;
                        dbClaim[sender] = userClaim;
                        saveDb(dbClaim);
                        await sock.sendMessage(from, { text: 'Claim sukses! +Rp 5,000' }, { quoted: msg });
                        break;

                    case 'transfer':
                        if (!args[0] || !args[1]) return sock.sendMessage(from, { text: 'Format: .transfer @tag <jumlah>' });
                        const targetT = m.messages[0].message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        const countT = parseInt(args[1]);
                        if (!targetT || isNaN(countT)) return sock.sendMessage(from, { text: 'Format salah.' });
                        const dbT = getDb();
                        dbT[sender] = dbT[sender] || { money: 1000 };
                        dbT[targetT] = dbT[targetT] || { money: 1000 };
                        if (dbT[sender].money < countT) return sock.sendMessage(from, { text: 'Uang tidak cukup.' });
                        dbT[sender].money -= countT;
                        dbT[targetT].money += countT;
                        saveDb(dbT);
                        await sock.sendMessage(from, { text: `Sukses transfer Rp ${countT.toLocaleString()} ke @${targetT.split('@')[0]}`, mentions: [targetT] }, { quoted: msg });
                        break;

                    case 'leaderboard':
                    case 'lb':
                        const dbLB = getDb();
                        const sortedLB = Object.keys(dbLB).map(k => ({ jid: k, money: dbLB[k].money })).sort((a, b) => b.money - a.money).slice(0, 10);
                        let lbText = `*「 LEADERBOARD 」*\n\n`;
                        sortedLB.forEach((v, i) => {
                            lbText += `${i + 1}. @${v.jid.split('@')[0]} - Rp ${v.money.toLocaleString()}\n`;
                        });
                        await sock.sendMessage(from, { text: lbText, mentions: sortedLB.map(v => v.jid) }, { quoted: msg });
                        break;

                    case 'afk':
                        const dbAfk = getDb();
                        dbAfk[sender] = dbAfk[sender] || { money: 1000 };
                        dbAfk[sender].afk = { reason: text || 'Tanpa alasan', time: Date.now() };
                        saveDb(dbAfk);
                        await sock.sendMessage(from, { text: `${pushname} sekarang AFK: ${text || 'Tanpa alasan'}` }, { quoted: msg });
                        break;

                    case 'tagall':
                        if (!from.endsWith('@g.us')) return;
                        const groupMetadata = await sock.groupMetadata(from);
                        const participants = groupMetadata.participants;
                        let tagText = `*「 TAG ALL 」*\n\nPesan: ${text || 'Tanpa pesan'}\n\n`;
                        const mentions = [];
                        for (let mem of participants) {
                            tagText += `@${mem.id.split('@')[0]} `;
                            mentions.push(mem.id);
                        }
                        await sock.sendMessage(from, { text: tagText, mentions }, { quoted: msg });
                        break;

                    case 'ytmp3':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Mana linknya?' });
                        try {
                            const res = await axios.get(`https://api.termai.cc/api/downloader/youtube?type=mp3&url=${encodeURIComponent(args[0])}&key=dabi-ai`);
                            if (res.data.status && res.data.data) {
                                await sock.sendMessage(from, { audio: { url: res.data.data.downloads[0].dlink }, mimetype: 'audio/mpeg' }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'fb':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Mana linknya?' });
                        try {
                            const res = await axios.get(`https://api.danzy.web.id/api/download/facebook?url=${encodeURIComponent(args[0])}`);
                            if (res.data.status && res.data.data) {
                                await sock.sendMessage(from, { video: { url: res.data.data.hd || res.data.data.sd } }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'ai':
                        if (!text) return sock.sendMessage(from, { text: 'Mau tanya apa?' });
                        try {
                            const dbAi = getDb();
                            const userAi = dbAi[sender] || { money: 1000 };
                            const model = userAi.roomai || 'chatgpt';
                            const res = await axios.get(`https://api.termai.cc/api/ai/${model}?q=${encodeURIComponent(text)}&key=dabi-ai`);
                            if (res.data.status && res.data.data) {
                                await sock.sendMessage(from, { text: res.data.data.answer }, { quoted: msg });
                            } else {
                                await sock.sendMessage(from, { text: `AI (${model}) tidak memberikan respon. Silakan coba lagi nanti.` }, { quoted: msg });
                            }
                        } catch (e) {
                            console.error(e);
                            await sock.sendMessage(from, { text: `Terjadi kesalahan saat menghubungi layanan AI. (Error: ${e.message})` }, { quoted: msg });
                        }
                        break;

                    case 'roomai':
                        if (!args[0]) return sock.sendMessage(from, { text: `Pilih model: kuroneko, metaai, wormgpt, gemini-lite\nContoh: ${botConfig.prefix}roomai kuroneko` });
                        const modelChoice = args[0].toLowerCase();
                        const validModels = ['kuroneko', 'metaai', 'wormgpt', 'gemini-lite'];
                        if (!validModels.includes(modelChoice)) return sock.sendMessage(from, { text: 'Model tidak valid.' });
                        const dbRoom = getDb();
                        dbRoom[sender] = dbRoom[sender] || { money: 1000 };
                        dbRoom[sender].roomai = modelChoice;
                        saveDb(dbRoom);
                        await sock.sendMessage(from, { text: `Room AI sekarang menggunakan model: ${modelChoice}` }, { quoted: msg });
                        break;

                    case 'delroomai':
                        const dbDelRoom = getDb();
                        if (!dbDelRoom[sender]?.roomai) return sock.sendMessage(from, { text: 'Kamu tidak sedang berada dalam sesi Room AI.' });
                        delete dbDelRoom[sender].roomai;
                        saveDb(dbDelRoom);
                        await sock.sendMessage(from, { text: 'Sesi Room AI telah dihapus. Sekarang menggunakan model default (ChatGPT).' }, { quoted: msg });
                        break;

                    case 'bypass':
                    case 'mathgpt':
                    case 'perplexed':
                    case 'gemini':
                        if (!text) return sock.sendMessage(from, { text: 'Masukkan pertanyaan.' });
                        try {
                            const resAi = await axios.get(`https://api.termai.cc/api/ai/${command}?q=${encodeURIComponent(text)}&key=dabi-ai`);
                            if (resAi.data.status && resAi.data.data) {
                                await sock.sendMessage(from, { text: resAi.data.data.answer }, { quoted: msg });
                            } else {
                                await sock.sendMessage(from, { text: `Layanan ${command} tidak memberikan respon.` }, { quoted: msg });
                            }
                        } catch (e) {
                            console.error(e);
                            await sock.sendMessage(from, { text: `Terjadi kesalahan pada fitur ${command}.` }, { quoted: msg });
                        }
                        break;

                    case 'deepimg':
                    case 'nsfwgen':
                        if (!text) return sock.sendMessage(from, { text: 'Masukkan prompt.' });
                        try {
                            const resImg = await axios.get(`https://api.termai.cc/api/maker/${command === 'deepimg' ? 'text2img' : 'nsfw-gen'}?prompt=${encodeURIComponent(text)}&key=dabi-ai`);
                            if (resImg.data.status) {
                                await sock.sendMessage(from, { image: { url: resImg.data.url }, caption: `Hasil ${command}` }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'editimg':
                        const qEdit = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        const imgEdit = msg.message?.imageMessage || qEdit?.imageMessage;
                        if (!imgEdit || !text) return sock.sendMessage(from, { text: 'Reply gambar dan masukkan prompt untuk edit.' });
                        try {
                            const bufEdit = await downloadMediaMessage(msg, 'buffer', {});
                            const formEdit = new (require('form-data'))();
                            formEdit.append('file', bufEdit, { filename: 'image.jpg' });
                            const resEdit = await axios.post(`https://api.termai.cc/api/tools/edit-image?prompt=${encodeURIComponent(text)}&key=dabi-ai`, formEdit, { headers: formEdit.getHeaders() });
                            if (resEdit.data.status) {
                                await sock.sendMessage(from, { image: { url: resEdit.data.url }, caption: 'Hasil Edit' }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'money':
                        const db = getDb();
                        const user = db[sender] || { money: 1000 };
                        await sock.sendMessage(from, { text: `Balance: Rp ${user.money.toLocaleString()}` }, { quoted: msg });
                        break;

                    case 'slot':
                        const taruhan = parseInt(args[0]) || 100;
                        const dbSlot = getDb();
                        dbSlot[sender] = dbSlot[sender] || { money: 1000 };
                        if (dbSlot[sender].money < taruhan) return sock.sendMessage(from, { text: 'Uang tidak cukup!' });

                        const emoji = ['🍒', '🍋', '⭐', '🍇'];
                        const a = emoji[Math.floor(Math.random() * emoji.length)];
                        const b = emoji[Math.floor(Math.random() * emoji.length)];
                        const c = emoji[Math.floor(Math.random() * emoji.length)];

                        dbSlot[sender].money -= taruhan;
                        let resText = `[ ${a} | ${b} | ${c} ]\n\n`;
                        if (a === b && b === c) {
                            const win = taruhan * 10;
                            dbSlot[sender].money += win;
                            resText += `MENANG! +Rp ${win.toLocaleString()}`;
                        } else {
                            resText += `KALAH! -Rp ${taruhan.toLocaleString()}`;
                        }
                        saveDb(dbSlot);
                        await sock.sendMessage(from, { text: resText }, { quoted: msg });
                        break;

                    case 'rob':
                        const dbRob = getDb();
                        const targetR = m.messages[0].message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (!targetR) return sock.sendMessage(from, { text: 'Tag target yang mau dirob!' });
                        dbRob[sender] = dbRob[sender] || { money: 1000 };
                        dbRob[targetR] = dbRob[targetR] || { money: 1000 };
                        if (dbRob[targetR].money < 500) return sock.sendMessage(from, { text: 'Target terlalu miskin.' });

                        const success = Math.random() > 0.5;
                        if (success) {
                            const stolen = Math.floor(Math.random() * 500);
                            dbRob[sender].money += stolen;
                            dbRob[targetR].money -= stolen;
                            saveDb(dbRob);
                            await sock.sendMessage(from, { text: `Berhasil merampok @${targetR.split('@')[0]} sebesar Rp ${stolen.toLocaleString()}!`, mentions: [targetR] }, { quoted: msg });
                        } else {
                            const fine = 200;
                            dbRob[sender].money -= fine;
                            saveDb(dbRob);
                            await sock.sendMessage(from, { text: `Gagal merampok! Kamu didenda Rp ${fine.toLocaleString()}` }, { quoted: msg });
                        }
                        break;

                    case 'ytmp4':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Mana linknya?' });
                        try {
                            const res = await axios.get(`https://api.termai.cc/api/downloader/youtube?type=mp4&url=${encodeURIComponent(args[0])}&key=dabi-ai`);
                            if (res.data.status && res.data.data) {
                                await sock.sendMessage(from, { video: { url: res.data.data.downloads[0].dlink }, caption: res.data.data.title }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'runtime':
                        const d = moment.duration(performance.now(), 'milliseconds');
                        const hours = Math.floor(d.asHours());
                        const mins = Math.floor(d.asMinutes()) - (hours * 60);
                        const secs = Math.floor(d.asSeconds()) - (hours * 3600) - (mins * 60);
                        await sock.sendMessage(from, { text: `Runtime: ${hours}h ${mins}m ${secs}s` }, { quoted: msg });
                        break;

                    case 'tagme':
                        await sock.sendMessage(from, { text: `@${senderNum}`, mentions: [sender] }, { quoted: msg });
                        break;

                    case 'react':
                        if (!m.messages[0].message?.extendedTextMessage?.contextInfo?.stanzaId) return sock.sendMessage(from, { text: 'Reply pesan yang mau direact.' });
                        if (!args[0]) return sock.sendMessage(from, { text: 'Masukkan emojinya.' });
                        await sock.sendMessage(from, {
                            react: {
                                text: args[0],
                                key: {
                                    remoteJid: from,
                                    fromMe: false,
                                    id: m.messages[0].message.extendedTextMessage.contextInfo.stanzaId,
                                    participant: m.messages[0].message.extendedTextMessage.contextInfo.participant
                                }
                            }
                        });
                        break;

                    case 'self':
                        if (!isOwner) return;
                        botConfig.public = false;
                        await sock.sendMessage(from, { text: 'Mode SELF aktif.' });
                        break;

                    case 'public':
                        if (!isOwner) return;
                        botConfig.public = true;
                        await sock.sendMessage(from, { text: 'Mode PUBLIC aktif.' });
                        break;

                    case 'cnbc':
                    case 'suara':
                    case 'liputan6':
                    case 'tribun':
                    case 'sindonews':
                    case 'kompas':
                    case 'merdeka':
                    case 'cnn':
                    case 'jkt48':
                    case 'antara':
                        try {
                            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
                            const sourceMap = {
                                'cnbc': 'cnbcindonesia',
                                'suara': 'suara',
                                'liputan6': 'liputan6',
                                'tribun': 'tribunnews',
                                'sindonews': 'sindonews',
                                'kompas': 'kompas',
                                'merdeka': 'merdeka',
                                'cnn': 'cnn',
                                'jkt48': 'jkt48',
                                'antara': 'antara'
                            };
                            const source = sourceMap[command];
                            const resNews = await axios.get(`https://api.siputzx.my.id/api/berita/${source}`);
                            if (resNews.data.status && resNews.data.data.length > 0) {
                                let newsText = `*「 ${command.toUpperCase()} NEWS 」*\n\n`;
                                resNews.data.data.slice(0, 5).forEach((item, i) => {
                                    newsText += `${i + 1}. *${item.title}*\n🔗 ${item.link}\n\n`;
                                });
                                await sock.sendMessage(from, { text: newsText }, { quoted: msg });
                            } else {
                                await sock.sendMessage(from, { text: `Gagal mengambil berita dari ${command}.` }, { quoted: msg });
                            }
                        } catch (e) {
                            console.error(e);
                            await sock.sendMessage(from, { text: `Terjadi kesalahan saat mengambil berita.` }, { quoted: msg });
                        }
                        break;

                    case 'blur':
                    case 'facepalm':
                        const qCan = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        const imgCan = msg.message?.imageMessage || qCan?.imageMessage;
                        if (!imgCan) return sock.sendMessage(from, { text: 'Reply atau kirim gambar.' });
                        try {
                            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
                            // In this bot, downloadMediaMessage is imported at top
                            const bufCan = await downloadMediaMessage(msg, 'buffer', {});
                            // Simple upload to get URL for canvas
                            const fd = new (require('form-data'))();
                            fd.append('file', bufCan, { filename: 'image.jpg' });
                            const resUp = await axios.post('https://api.termai.cc/api/tools/upload', fd, { headers: fd.getHeaders() });
                            const imgUrl = resUp.data.url;
                            const resCan = await axios.get(`https://api.siputzx.my.id/api/canvas/${command}?image=${encodeURIComponent(imgUrl)}`, { responseType: 'arraybuffer' });
                            await sock.sendMessage(from, { image: Buffer.from(resCan.data), caption: `Hasil ${command}` }, { quoted: msg });
                        } catch (e) { console.error(e); }
                        break;

                    case 'tolol':
                        if (!text) return sock.sendMessage(from, { text: 'Masukkan nama.' });
                        try {
                            const resTolol = await axios.get(`https://api.siputzx.my.id/api/canvas/sertifikat-tolol?text=${encodeURIComponent(text)}`, { responseType: 'arraybuffer' });
                            await sock.sendMessage(from, { image: Buffer.from(resTolol.data), caption: 'Anjay tolol' }, { quoted: msg });
                        } catch (e) { console.error(e); }
                        break;

                    case 'tebak-kartun':
                    case 'tebakkartun':
                    case 'tebak-kata':
                    case 'tebakkata':
                    case 'tebak-bendera':
                    case 'tebakbendera':
                    case 'karakter-freefire':
                    case 'tebak-hewan':
                    case 'tebakhewan':
                    case 'tebak-jkt':
                    case 'tebakjkt':
                    case 'tebak-tebakan':
                    case 'tebaktebakan':
                    case 'family100':
                    case 'family-100':
                    case 'tebak-gambar':
                    case 'tebakgambar':
                    case 'cak-lontong':
                    case 'caklontong':
                    case 'tebak-kalimat':
                    case 'tebakkalimat':
                    case 'lengkapi-kalimat':
                    case 'lengkapikalimat':
                    case 'tekateki':
                    case 'teka-teki':
                    case 'asah-otak':
                    case 'asahotak':
                    case 'susun-kata':
                    case 'susunkata':
                    case 'tebak-lagu':
                    case 'tebaklagu':
                    case 'tebak-kimia':
                    case 'tebakkimia':
                    case 'tebak-game':
                    case 'tebakgame':
                    case 'tebak-logo':
                    case 'tebaklogo':
                    case 'surah':
                    case 'tebak-lirik':
                    case 'tebaklirik':
                    case 'siapa-kah-aku':
                    case 'siapakahaku':
                    case 'tebak-bendera':
                    case 'tebakbendera':
                        const gameName = command.replace(/-/g, '');
                        if (gameSessions[from]) return sock.sendMessage(from, { text: 'Ada game yang sedang berjalan di chat ini!' });
                        try {
                            const resG = await axios.get(`https://api.siputzx.my.id/api/games/${gameName}`);
                            if (resG.data.status) {
                                const data = resG.data.data;
                                const answer = data.jawaban || data.name || (data.data && data.data.jawaban) || data.result;
                                if (!answer) return sock.sendMessage(from, { text: 'Gagal mengambil jawaban dari API.' });
                                
                                gameSessions[from] = {
                                    answer: answer,
                                    command: gameName,
                                    timeout: setTimeout(() => {
                                        if (gameSessions[from]) {
                                            const ansText = Array.isArray(gameSessions[from].answer) ? gameSessions[from].answer[0] : gameSessions[from].answer;
                                            sock.sendMessage(from, { text: `⏱️ *WAKTU HABIS!*\nJawaban yang benar adalah: *${ansText}*` });
                                            delete gameSessions[from];
                                        }
                                    }, 60000)
                                };
                                let qMessage = `*GAME: ${gameName.toUpperCase()}*\n\n`;
                                qMessage += data.soal || data.pertanyaan || data.unsur || (data.data && data.data.soal) || "Tebak ya!";
                                if (data.deskripsi) qMessage += `\n\n*Hint:* ${data.deskripsi}`;

                                if (data.img || data.gambar || (data.data && data.data.img) || (data.data && data.data.image)) {
                                    const imgG = data.img || data.gambar || (data.data && data.data.img) || (data.data && data.data.image);
                                    await sock.sendMessage(from, { image: { url: imgG }, caption: qMessage }, { quoted: msg });
                                } else if (data.lagu || data.audio) {
                                    const audG = data.lagu || data.audio;
                                    await sock.sendMessage(from, { audio: { url: audG }, mimetype: 'audio/mpeg', caption: qMessage }, { quoted: msg });
                                } else {
                                    await sock.sendMessage(from, { text: qMessage }, { quoted: msg });
                                }
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'restart':
                        if (!isOwner) return sock.sendMessage(from, { text: 'Hanya untuk owner!' });
                        await sock.sendMessage(from, { text: 'Bot akan direstart...' });
                        setTimeout(() => {
                            process.exit(0);
                        }, 1000);
                        break;

                    case 'stop':
                        if (!isOwner) return sock.sendMessage(from, { text: 'Hanya untuk owner!' });
                        await sock.sendMessage(from, { text: 'Bot dimatikan.' });
                        setTimeout(() => {
                            process.exit(0);
                        }, 1000);
                        break;

                    case 'ping':
                        const start = performance.now();
                        const ping = performance.now() - start;
                        await sock.sendMessage(from, { text: `Pong! Speed: ${ping.toFixed(2)}ms` }, { quoted: msg });
                        break;
                }
            }
        } catch (e) {
            console.log(e);
        }
    });

}

startBot();

import fs from 'fs'
import path from 'path'

const userDbPath = path.join(global.root, 'system/db/user.json')
const groupDbPath = path.join(global.root, 'system/db/group.json')

// Ensure DB files exist
if (!fs.existsSync(userDbPath)) {
    fs.mkdirSync(path.dirname(userDbPath), { recursive: true })
    fs.writeFileSync(userDbPath, JSON.stringify({ key: {} }, null, 2))
}
if (!fs.existsSync(groupDbPath)) {
    fs.mkdirSync(path.dirname(groupDbPath), { recursive: true })
    fs.writeFileSync(groupDbPath, JSON.stringify({ key: {} }, null, 2))
}

export const authUser = async (m) => {
    const jid = m.key.participant || m.key.remoteJid
    const name = m.pushName || 'User'
    const db = JSON.parse(fs.readFileSync(userDbPath, 'utf-8'))
    
    if (!db.key[jid]) {
        db.key[jid] = {
            jid,
            name,
            noId: Math.floor(Math.random() * 1000000).toString(),
            ban: false,
            acc: 0,
            exp: 0,
            cmd: 0,
            ai: { bell: false, chat: 0, role: 'User' },
            moneyDb: { money: 1000, moneyInBank: 0 },
            game: { farm: false, robbery: { cost: 5 } },
            afk: { status: false, reason: '', afkStart: 0 }
        }
        fs.writeFileSync(userDbPath, JSON.stringify(db, null, 2))
    }
}

export const authGroup = async (m) => {
    const jid = m.key.remoteJid
    if (!jid.endsWith('@g.us')) return
    const db = JSON.parse(fs.readFileSync(groupDbPath, 'utf-8'))
    if (!db.key[jid]) {
        db.key[jid] = {
            id: jid,
            subject: 'Grup',
            filter: {
                welcome: { welcomeGc: false },
                left: { leftGc: false },
                antilink: false,
                antibadword: { antibadword: false, badwordtext: [] },
                antich: false,
                antitag: false
            }
        }
        fs.writeFileSync(groupDbPath, JSON.stringify(db, null, 2))
    }
}

export const authFarm = async (m) => {
    const jid = m.key.remoteJid
    const db = JSON.parse(fs.readFileSync(userDbPath, 'utf-8'))
    const user = db.key[jid]
    if (user?.game?.farm) {
        user.moneyDb.money += 10
        user.exp += 1
        fs.writeFileSync(userDbPath, JSON.stringify(db, null, 2))
    }
}

global.save = {
    db: () => {
        // Saving user DB is usually handled inside commands or via a global db object
    },
    gc: () => {
        // Placeholder for consistency
    }
}

global.getGc = (chat) => {
    const db = JSON.parse(fs.readFileSync(groupDbPath, 'utf-8'))
    return db.key[chat.id]
}

export const role = () => {
    // Logic to update user roles based on exp
}

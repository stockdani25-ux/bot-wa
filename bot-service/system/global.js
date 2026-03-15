import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import moment from 'moment-timezone'
import chalk from 'chalk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

global.dirname = __dirname
global.root = path.join(__dirname, '../')

// --- Styling ---
global.head = '╭───'
global.body = '│'
global.foot = '╰───'
global.line = '────────────────────'
global.btn = '•'
global.opb = '「'
global.clb = '」'

// --- Bot Settings ---
const configPath = path.join(global.root, 'system/set/config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

global.botName = config.botSetting.botName
global.botFullName = config.botSetting.botFullName
global.ownerName = config.ownerSetting.ownerName
global.ownerNumber = config.ownerSetting.ownerNumber
global.prefix = config.botSetting.prefix
global.public = config.ownerSetting.public
global.idCh = config.botSetting.idCh
global.thumbnail = config.botSetting.thumbnail
global.footer = config.botSetting.footer

// --- Helpers ---
global.log = console.log
global.err = (msg, e) => console.error(chalk.redBright.bold(msg), e)
global.readmore = String.fromCharCode(8206).repeat(4001)

global.time = {
    timeIndo: (tz, format) => moment().tz(tz).format(format)
}

global.number = (v) => v.replace(/[^0-9]/g, '')

// Database Loaders (To be implemented in data.js)
global.db = () => JSON.parse(fs.readFileSync(path.join(global.root, 'system/db/user.json'), 'utf-8'))
global.getGc = (chat) => {
    const db = JSON.parse(fs.readFileSync(path.join(global.root, 'system/db/group.json'), 'utf-8'))
    return Object.values(db.key).find(g => g.id === chat.id)
}
global.save = {
    db: () => {}, // To be defined
    gc: () => {}  // To be defined
}

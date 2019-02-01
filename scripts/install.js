const os = require('os')
const fs = require('fs')
const { execSync } = require('child_process')

const log = console.error.bind(console) // eslint-disable-line no-console

const HOME = process.env.HOME || os.homedir()
const RELEASE_API_URL = 'https://d236jo9e8rrdox.cloudfront.net/yvm-releases'
const USE_LOCAL = process.env.USE_LOCAL || false
const INSTALL_VERSION = process.env.INSTALL_VERSION || null
const YVM_DIR = process.env.YVM_INSTALL_DIR || `${HOME}/.yvm`
const ZIP_DOWNLOAD_PATH = `${YVM_DIR}/yvm.zip`
const SH_INSTALL_PATH = `${YVM_DIR}/yvm.sh`
const YVM_DIR_VARIABLE = 'YVM_DIR'
const EXPORT_YVM_DIR_STRING = `export ${YVM_DIR_VARIABLE}=${YVM_DIR}`
const EXECUTE_SOURCE_STRING = `[ -r $${YVM_DIR_VARIABLE}/yvm.sh ] && source $${YVM_DIR_VARIABLE}/yvm.sh`

/**
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
 * @param {string} src to be escaped
 */
function escapeRegExp(src) {
    return src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function ensureDir(dirPath) {
    if (fs.existsSync(dirPath)) return
    fs.mkdirSync(dirPath)
}

function getVersionDownloadUrl(version) {
    return `https://github.com/tophat/yvm/releases/download/${version}/yvm.zip`
}

async function getLatestYvmVersion() {
    const data = execSync(`curl -s ${RELEASE_API_URL}`)
    const {
        tag_name: tagName,
        assets: [{ browser_download_url: downloadUrl }],
    } = JSON.parse(data)
    return { tagName, downloadUrl }
}

async function downloadFile(urlPath, filePath) {
    execSync(`curl -s -L -o '${filePath}' '${urlPath}'`)
}

async function removeFile(filePath) {
    execSync(`rm -rf ${filePath}`)
}

async function cleanYvmDir() {
    await Promise.all(
        ['yvm.sh', 'yvm.js', 'yvm-exec.js', 'node_modules']
            .map(file => `${YVM_DIR}/${file}`)
            .map(removeFile)
            .map(promise => promise.catch(log)),
    )
}

async function unzipFile(filePath) {
    execSync(`unzip -o -q ${filePath} -d ${YVM_DIR}`)
}

async function saveVersion(versionTag) {
    const filePath = `${YVM_DIR}/.version`
    fs.writeFileSync(filePath, `{ "version": "${versionTag}" }`)
}

async function ensureYvmScriptExecutable() {
    execSync(`chmod +x ${SH_INSTALL_PATH}`)
}

async function ensureRC(rcFile) {
    if (!fs.statSync(rcFile)) return
    let contents = fs.readFileSync(rcFile).toString()
    const stringsToEnsure = [EXPORT_YVM_DIR_STRING, EXECUTE_SOURCE_STRING]
    const linesAppended = stringsToEnsure.map(string => {
        const finalString = `\n${string}`
        if (contents.includes(string)) {
            const matchString = new RegExp(`\n.*${escapeRegExp(string)}.*`)
            contents = contents.replace(matchString, finalString)
            return false
        }
        contents += finalString
        return true
    })
    if (linesAppended.some(a => a)) {
        contents += '\n'
    }
    fs.writeFileSync(rcFile, contents)
}

async function run() {
    const yvmDirectoryExists = ensureDir(YVM_DIR)
    const zipFile = USE_LOCAL ? 'artifacts/yvm.zip' : ZIP_DOWNLOAD_PATH
    const version = {}
    if (!USE_LOCAL) {
        if (INSTALL_VERSION) {
            version.downloadUrl = getVersionDownloadUrl(INSTALL_VERSION)
            version.tagName = INSTALL_VERSION
        } else {
            log('Querying github release API to determine latest version')
            Object.assign(version, await getLatestYvmVersion())
        }
        await downloadFile(version.downloadUrl, zipFile)
    }
    if (version.tagName) {
        log(`Installing Version: ${version.tagName}`)
    }
    await yvmDirectoryExists
    await cleanYvmDir()
    await unzipFile(zipFile)

    const ongoingTasks = []
    if (!USE_LOCAL) {
        ongoingTasks.push(removeFile(zipFile))
    }
    if (version.tagName) {
        ongoingTasks.push(saveVersion(version.tagName))
    }
    ongoingTasks.push(ensureYvmScriptExecutable())
    const updatingShellConfigs = ['.bashrc', '.zshrc']
        .map(name => `${HOME}/${name}`)
        .map(ensureRC)
    ongoingTasks.push(...updatingShellConfigs)
    await Promise.all(ongoingTasks)

    log(`yvm successfully installed in ${YVM_DIR} as ${SH_INSTALL_PATH}
Open another terminal window to start using it, or type "source ${SH_INSTALL_PATH}"`)
}

run().catch(error => {
    log('yvm installation failed')
    log(error)
})

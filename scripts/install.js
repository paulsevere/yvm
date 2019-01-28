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
        tag_name: versionTag,
        assets: [{ browser_download_url: downloadUrl }],
    } = JSON.parse(data)
    return { versionTag, downloadUrl }
}

async function downloadFile(urlPath, filePath) {
    execSync(`curl -s -L -o '${filePath}' '${urlPath}'`)
}

async function removeFile(filepath) {
    execSync(`rm -rf ${filepath}`)
}

async function cleanYvmDir() {
    await Promise.all(
        ['yvm.sh', 'yvm.js', 'yvm-exec.js', 'node_modules']
            .map(filename => `${YVM_DIR}/${filename}`)
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
    const contents = fs.readFileSync(rcFile)
    const stringsToEnsure = [EXPORT_YVM_DIR_STRING, EXECUTE_SOURCE_STRING]
    const linesAppended = stringsToEnsure.map(string => {
        if (contents.includes(string)) return false
        fs.appendFileSync(rcFile, `\n${string}`)
        return true
    })
    if (linesAppended.some(a => a)) {
        fs.appendFileSync(rcFile, '\n')
    }
}

async function run() {
    const yvmDirectoryExists = ensureDir(YVM_DIR)
    let zipFile, versionTag
    if (USE_LOCAL) {
        zipFile = 'artifacts/yvm.zip'
    } else {
        let downloadUrl
        if (INSTALL_VERSION) {
            downloadUrl = getVersionDownloadUrl(INSTALL_VERSION)
            versionTag = INSTALL_VERSION
        } else {
            log('Querying github release API to determine latest version')
            ;({ downloadUrl, versionTag } = await getLatestYvmVersion())
        }
        zipFile = ZIP_DOWNLOAD_PATH
        await downloadFile(downloadUrl, zipFile)
    }
    if (versionTag) {
        log(`Installing Version: ${versionTag}`)
    }
    await yvmDirectoryExists
    await cleanYvmDir()
    await unzipFile(zipFile)

    const ongoingTasks = []
    if (!USE_LOCAL) {
        ongoingTasks.push(removeFile(zipFile))
    }
    if (versionTag) {
        ongoingTasks.push(saveVersion(versionTag))
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

run()

const os = require('os')
const fs = require('fs')
const mockFs = require('mock-fs')

const { escapeRegExp, getConfig, run } = require('./install')

describe('yvm install', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {})
    const mockHome = '/usr/mock/'
    const spyEnvHome = jest.spyOn(process.env, 'HOME', 'get').mockReturnValue()
    jest.spyOn(os, 'homedir').mockReturnValue(mockHome)

    const confirmShellConfig = rcFile => {
        const content = fs.readFileSync(rcFile).toString()
        const { rcStrings } = getConfig()
        rcStrings.forEach(string => {
            const exactMatch = new RegExp(`\n${escapeRegExp(string)}\n`)
            expect(content.match(exactMatch)).toEqual(true)
        })
    }

    beforeEach(() => {
        mockFs({
            mockHome: {
                '.bashrc': '',
                '.zshrc': '',
            },
        })
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    afterAll(() => {
        jest.restoreAllMocks()
        mockFs.restore()
    })

    describe('local version', () => {
        it('completes successfully', async () => {
            expect(log.mock.calls).toMatchSnapshot()
        })

        it('creates home install directory if does not exist', async () => {
            const testHome = '/usr/test/'
            spyEnvHome.mockReturnValueOnce(testHome)
        })

        it('creates specified install directory if does not exist', async () => {
            const mockInstallDir = '/yvm-install-directory'
            process.env.YVM_INSTALL_DIR = mockInstallDir
        })

        it('does not remove local zip file', () => {})

        it('configures .bashrc', async () => {
            await run()
            confirmShellConfig(`${mockHome}/.bashrc`)
        })

        it('configures .zshrc', async () => {
            await run()
            confirmShellConfig(`${mockHome}/.zshrc`)
        })

        it('does not fail if rc files do not exist', async () => {
            mockFs({ mockHome: {} })
            await run()
        })
    })

    describe('latest version', () => {})

    describe('specified version', () => {})
})

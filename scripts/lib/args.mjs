/**
 * Extract `--dashboard <name>` / `--dashboard=<name>` from a CLI arg list.
 * Returns { name, rest } where `name` is null when the flag is absent and
 * `rest` is the arg list with the flag (and its value) removed.
 */
export const parseDashboardFlag = (args) => {
    let name = null
    const rest = []
    for (let index = 0; index < args.length; index++) {
        const arg = args[index]
        if (arg === '--dashboard') {
            const value = args[index + 1]
            if (value === undefined || value.startsWith('--')) {
                throw new Error('--dashboard requires a name')
            }
            name = value
            index++
            continue
        }
        if (arg.startsWith('--dashboard=')) {
            const value = arg.slice('--dashboard='.length)
            if (value.length === 0) {
                throw new Error('--dashboard requires a name')
            }
            name = value
            continue
        }
        rest.push(arg)
    }
    return { name, rest }
}

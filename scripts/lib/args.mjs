/**
 * Pull every `--<flag> <value>` / `--<flag>=<value>` out of a CLI arg list.
 * Returns { values, rest } where `values` is in argument order and `rest`
 * is the arg list with those flags (and their values) removed.
 */
const extractFlagValues = (args, flag, valueLabel) => {
    const values = []
    const rest = []
    const missing = () => new Error(`--${flag} requires a ${valueLabel}`)
    for (let index = 0; index < args.length; index++) {
        const arg = args[index]
        if (arg === `--${flag}`) {
            const value = args[index + 1]
            if (value === undefined || value.startsWith('--')) {
                throw missing()
            }
            values.push(value)
            index++
            continue
        }
        if (arg.startsWith(`--${flag}=`)) {
            const value = arg.slice(`--${flag}=`.length)
            if (value.length === 0) {
                throw missing()
            }
            values.push(value)
            continue
        }
        rest.push(arg)
    }
    return { values, rest }
}

/**
 * Extract `--dashboard <name>` / `--dashboard=<name>` from a CLI arg list.
 * Returns { name, rest } where `name` is null when the flag is absent and
 * `rest` is the arg list with the flag (and its value) removed.
 */
export const parseDashboardFlag = (args) => {
    const { values, rest } = extractFlagValues(args, 'dashboard', 'name')
    return { name: values.at(-1) ?? null, rest }
}

/**
 * Extract every `--star-for <username>` / `--star-for=<username>` (the flag
 * repeats, one user each). Returns { usernames, rest }, usernames deduped.
 */
export const parseStarForFlags = (args) => {
    const { values, rest } = extractFlagValues(args, 'star-for', 'username')
    return { usernames: [...new Set(values)], rest }
}

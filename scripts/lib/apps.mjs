/**
 * Post-upload verification against the DHIS2 app store.
 *
 * `d2-app-scripts deploy` uploads the bundle and then smoke-tests the app's
 * launch URL (GET /api/apps/<key>/), failing the whole command when that
 * request does not come back 2xx. Instances that answer it with a redirect
 * to their login page — especially one that switches scheme, which drops the
 * basic-auth header on the way — fail that check even though the upload
 * succeeded. So deploy asks the API directly which apps are installed
 * instead of trusting the exit code alone.
 */

const basicAuth = (username, password) =>
    `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

/**
 * Every identifier a GET /api/apps payload offers per app. Servers disagree
 * on the field name (`key` on modern ones, `folderName`/`short_name`
 * elsewhere), and membership is all deploy needs — so collect them all
 * rather than guess which one this instance uses.
 */
export const parseAppKeys = (payload) => {
    const apps = Array.isArray(payload) ? payload : (payload?.apps ?? [])
    if (!Array.isArray(apps)) {
        return new Set()
    }
    const keys = new Set()
    for (const app of apps) {
        if (typeof app !== 'object' || app === null) {
            continue
        }
        for (const value of [
            app.key,
            app.folderName,
            app.short_name,
            app.name,
        ]) {
            if (typeof value === 'string' && value.length > 0) {
                keys.add(value)
            }
        }
    }
    return keys
}

/**
 * The set of app identifiers installed on `url`. Redirects are not followed:
 * an instance that bounces an unauthenticated request to its login page
 * should surface as a clear status, not as HTML that fails to parse.
 */
export const fetchInstalledAppKeys = async ({
    url,
    username,
    password,
    fetchImpl = fetch,
}) => {
    const endpoint = `${url.replace(/\/+$/, '')}/api/apps`
    const response = await fetchImpl(endpoint, {
        headers: {
            Authorization: basicAuth(username, password),
            Accept: 'application/json',
        },
        redirect: 'manual',
    })
    if (!response.ok) {
        throw new Error(`GET /api/apps → ${response.status}`)
    }
    const text = await response.text()
    try {
        return parseAppKeys(JSON.parse(text))
    } catch {
        throw new Error(
            `GET /api/apps returned unparseable JSON: ${text.slice(0, 200)}`
        )
    }
}

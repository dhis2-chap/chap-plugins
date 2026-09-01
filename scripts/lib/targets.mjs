/**
 * Resolve a deploy/seed target (local | demo | explicit URL) to a DHIS2
 * base URL plus credentials:
 *   local — $DHIS2_LOCAL_URL (default http://localhost:8090), admin/district
 *   demo  — $DHIS2_DEMO_URL (required), $D2_USERNAME/$D2_PASSWORD
 *   url   — the URL as-is, $D2_USERNAME/$D2_PASSWORD
 * username/password may come back undefined for demo/url targets — callers
 * decide how to fail.
 */
export const resolveTarget = (target, env = process.env) => {
    if (target === 'local') {
        return {
            url: env.DHIS2_LOCAL_URL ?? 'http://localhost:8090',
            username: env.D2_USERNAME ?? 'admin',
            password: env.D2_PASSWORD ?? 'district',
        }
    }
    if (target === 'demo') {
        if (!env.DHIS2_DEMO_URL) {
            throw new Error('target demo: DHIS2_DEMO_URL is not set')
        }
        return {
            url: env.DHIS2_DEMO_URL,
            username: env.D2_USERNAME,
            password: env.D2_PASSWORD,
        }
    }
    return {
        url: target,
        username: env.D2_USERNAME,
        password: env.D2_PASSWORD,
    }
}

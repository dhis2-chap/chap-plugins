import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { MODELING_APP_HUB_ID } from './modelingLinks'

type AppsResponse = {
    apps: Array<{ app_hub_id?: string | null; launchUrl?: string | null }>
}

/**
 * The installed modeling app's launch URL, or undefined when this instance
 * doesn't have it — plenty of instances run the widgets without it, and a
 * button pointing at a 404 is worse than no button. Failures resolve the same
 * way, so the link simply doesn't appear.
 *
 * The query key is shared, so every widget on a dashboard asks once between
 * them, and the answer never goes stale within a session.
 */
export const useModelingAppUrl = (): string | undefined => {
    const engine = useDataEngine()

    const { data } = useQuery({
        queryKey: ['dhis2', 'modelingAppUrl'],
        staleTime: Infinity,
        retry: false,
        queryFn: async () => {
            const response = (await engine.query({
                apps: { resource: 'apps' },
            })) as AppsResponse
            const app = response.apps?.find(
                (candidate) => candidate.app_hub_id === MODELING_APP_HUB_ID
            )
            // null, not undefined: react-query rejects undefined query data
            return app?.launchUrl ?? null
        },
    })

    return data ?? undefined
}

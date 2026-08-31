import { useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { NoticeBox } from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { SystemService } from '../chap-api'
import type { SystemInfoResponse } from '../chap-api'
import { LoadingState } from '../plugin/states'
import styles from '../plugin/states.module.css'

type ChapRoute = {
    id: string
    code: string
    url: string
    disabled?: boolean
}

/** The DHIS2 route the CHAP backend is reached through (created by the Modeling App's settings). */
const CHAP_ROUTE_CODE = 'chap'

const useChapRoute = () => {
    const engine = useDataEngine()

    return useQuery<ChapRoute | null>({
        queryKey: ['dhis2', 'routes', CHAP_ROUTE_CODE],
        queryFn: async () => {
            const response = (await engine.query({
                routes: {
                    resource: 'routes',
                    params: {
                        filter: `code:eq:${CHAP_ROUTE_CODE}`,
                        fields: 'id,code,url,disabled',
                    },
                },
            })) as { routes: { routes?: ChapRoute[] } }
            return response.routes.routes?.[0] ?? null
        },
        staleTime: Infinity,
        cacheTime: Infinity,
        refetchOnWindowFocus: false,
    })
}

export const useChapSystemInfo = ({
    enabled = true,
}: { enabled?: boolean } = {}) =>
    useQuery<SystemInfoResponse>({
        queryKey: ['chap', 'system-info'],
        queryFn: () => SystemService.systemInfoSystemInfoGet(),
        enabled,
        retry: 0,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    })

const NoChapBackend = ({ reason }: { reason: 'no-route' | 'unreachable' }) => (
    <div className={styles.centeredState}>
        <div className={styles.noticeWrap}>
            <NoticeBox warning title={i18n.t('CHAP backend not available')}>
                {reason === 'no-route'
                    ? i18n.t(
                          'This DHIS2 instance has no "chap" route configured. Open the CHAP Modeling App settings to connect a running chap-core server, then reload this dashboard.'
                      )
                    : i18n.t(
                          'The "chap" route exists but the CHAP backend did not respond. Check that chap-core is running and reachable from the DHIS2 server.'
                      )}
            </NoticeBox>
        </div>
    </div>
)

/**
 * Gates children on a working CHAP backend: the DHIS2 "chap" route must exist
 * and chap-core must answer /system/info through it. Otherwise renders a
 * friendly card instead of letting every request in the widget fail.
 */
export const ChapGuard = ({ children }: { children: React.ReactNode }) => {
    const routeQuery = useChapRoute()
    const hasRoute = !!routeQuery.data && !routeQuery.data.disabled
    const systemInfoQuery = useChapSystemInfo({ enabled: hasRoute })

    if (routeQuery.isLoading) {
        return <LoadingState />
    }
    if (routeQuery.isError || !hasRoute) {
        return <NoChapBackend reason="no-route" />
    }
    if (systemInfoQuery.isLoading) {
        return <LoadingState />
    }
    if (systemInfoQuery.isError) {
        return <NoChapBackend reason="unreachable" />
    }

    return <>{children}</>
}

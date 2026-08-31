import { useDataEngine, useAlert } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ZodType, ZodTypeDef } from 'zod'
import { isDhis2NotFound } from './dhis2Error'

/**
 * Every widget stores its per-dashboard-item config as one datastore entry:
 * dataStore/chap-widgets/<dashboardItemId>. dashboardItemIds are unique
 * across dashboards, so one open namespace serves all widgets.
 */
export const DATASTORE_NAMESPACE = 'chap-widgets'

const getConfigResource = (dashboardItemId: string) =>
    `dataStore/${DATASTORE_NAMESPACE}/${dashboardItemId}`

const getConfigQueryKey = (dashboardItemId: string | undefined) => [
    'dataStore',
    DATASTORE_NAMESPACE,
    dashboardItemId ?? 'missing-dashboard-item',
]

/**
 * Reads the stored config for a dashboard item, validated against the
 * widget's zod schema. Missing (404) or schema-invalid entries resolve to
 * null, which the WidgetShell renders as "not configured yet".
 */
export const useDashboardItemConfig = <T>(
    dashboardItemId: string | undefined,
    schema: ZodType<T, ZodTypeDef, unknown>
) => {
    const engine = useDataEngine()

    return useQuery<T | null>({
        queryKey: getConfigQueryKey(dashboardItemId),
        enabled: !!dashboardItemId,
        queryFn: async () => {
            try {
                const response = await engine.query({
                    config: {
                        resource: getConfigResource(dashboardItemId ?? ''),
                    },
                })
                const parsed = schema.safeParse(response.config)
                return parsed.success ? parsed.data : null
            } catch (error) {
                if (isDhis2NotFound(error)) {
                    return null
                }
                throw error
            }
        },
    })
}

export const useSaveDashboardItemConfig = <T>(
    dashboardItemId: string | undefined
) => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()
    const { show: showSuccessAlert } = useAlert(
        i18n.t('Widget configuration saved'),
        { success: true }
    )
    const { show: showErrorAlert } = useAlert(
        i18n.t('Failed to save widget configuration'),
        { critical: true }
    )

    return useMutation<unknown, Error, T>({
        mutationFn: async (config) => {
            if (!dashboardItemId) {
                throw new Error('Missing dashboard item id')
            }
            // type 'update' with an empty id creates-or-updates the datastore key
            return engine.mutate({
                resource: getConfigResource(dashboardItemId),
                type: 'update' as const,
                id: '',
                data: config as Record<string, unknown>,
            })
        },
        onSuccess: (_result, config) => {
            queryClient.setQueryData(getConfigQueryKey(dashboardItemId), config)
            showSuccessAlert()
        },
        onError: (error) => {
            console.error('Failed to save widget configuration:', error)
            showErrorAlert()
        },
    })
}

export const useDeleteDashboardItemConfig = (
    dashboardItemId: string | undefined
) => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()

    return useMutation<unknown, Error, void>({
        mutationFn: async () => {
            if (!dashboardItemId) {
                return undefined
            }
            try {
                return await engine.mutate({
                    resource: getConfigResource(dashboardItemId),
                    type: 'delete' as const,
                    id: '',
                })
            } catch (error) {
                if (isDhis2NotFound(error)) {
                    return undefined
                }
                throw error
            }
        },
        onSuccess: () => {
            queryClient.setQueryData(getConfigQueryKey(dashboardItemId), null)
        },
    })
}

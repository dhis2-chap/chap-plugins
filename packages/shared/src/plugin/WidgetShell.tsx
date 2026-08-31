import i18n from '@dhis2/d2-i18n'
import React, { useEffect, useRef } from 'react'
import type { ZodType, ZodTypeDef } from 'zod'
import {
    useDashboardItemConfig,
    useDeleteDashboardItemConfig,
    useSaveDashboardItemConfig,
} from '../config/useDashboardItemConfig'
import { LoadingState, PassiveState, ErrorState } from './states'
import type { DashboardPluginProps } from './types'

export type ConfigFormProps<T> = {
    /** The stored config, or null when the item hasn't been configured yet */
    config: T | null
    onSave: (config: T) => void
    isSaving: boolean
}

export type WidgetShellProps<T> = {
    /** The props the Dashboard app passed to the plugin entrypoint */
    plugin: DashboardPluginProps
    /** zod schema for this widget's config (input may differ, e.g. defaults) */
    schema: ZodType<T, ZodTypeDef, unknown>
    /** Dashboard item title used until the config provides one */
    defaultTitle: string
    /** Derive the dashboard item title from a stored config */
    getItemTitle?: (config: T) => string | undefined
    ConfigForm: React.ComponentType<ConfigFormProps<T>>
    View: React.ComponentType<{ config: T }>
}

/**
 * The state machine every widget shares: loads the per-item config from the
 * datastore, shows the ConfigForm in dashboard edit mode, the View in view
 * mode, and passive cards for the loading/unconfigured/error states. Also
 * wires the item title and delete-cleanup into the Dashboard app.
 */
export function WidgetShell<T>({
    plugin,
    schema,
    defaultTitle,
    getItemTitle,
    ConfigForm,
    View,
}: WidgetShellProps<T>) {
    const {
        dashboardItemId,
        dashboardMode = 'view',
        setDashboardItemDetails,
    } = plugin
    const configQuery = useDashboardItemConfig(dashboardItemId, schema)
    const saveMutation = useSaveDashboardItemConfig<T>(dashboardItemId)
    const deleteMutation = useDeleteDashboardItemConfig(dashboardItemId)
    const config = configQuery.data ?? null

    // Keep the latest delete mutation reachable from the stable onRemove
    // callback without retriggering the details effect every render
    const deleteMutationRef = useRef(deleteMutation)
    deleteMutationRef.current = deleteMutation

    const itemTitle =
        (config ? getItemTitle?.(config) : undefined) || defaultTitle

    useEffect(() => {
        setDashboardItemDetails?.({
            itemTitle,
            onRemove: async () => {
                await deleteMutationRef.current.mutateAsync()
            },
        })
    }, [setDashboardItemDetails, itemTitle])

    if (!dashboardItemId) {
        return (
            <PassiveState title={i18n.t('Missing dashboard item')}>
                {i18n.t('This widget can only run as a dashboard item.')}
            </PassiveState>
        )
    }
    if (configQuery.isLoading) {
        return <LoadingState />
    }
    if (configQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not load configuration')}>
                {i18n.t(
                    'Loading the widget configuration from the datastore failed. Try reloading the dashboard.'
                )}
            </ErrorState>
        )
    }
    if (dashboardMode === 'edit') {
        return (
            <ConfigForm
                config={config}
                onSave={(next) => saveMutation.mutate(next)}
                isSaving={saveMutation.isLoading}
            />
        )
    }
    if (!config) {
        return (
            <PassiveState title={i18n.t('Widget not configured')}>
                {i18n.t('Configure this widget while editing the dashboard.')}
            </PassiveState>
        )
    }

    return <View config={config} />
}

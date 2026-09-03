import {
    ChapGuard,
    ChapProvider,
    WidgetShell,
    type DashboardPluginProps,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { CssReset, CssVariables } from '@dhis2/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ConfigSchema } from './config'
import { ConfigForm } from './ConfigForm'
import { WidgetView } from './WidgetView'

const queryClient = new QueryClient()

const Plugin = (props: DashboardPluginProps) => (
    <QueryClientProvider client={queryClient}>
        <CssReset />
        <CssVariables theme spacers colors elevations />
        <ChapProvider>
            <ChapGuard>
                <WidgetShell
                    plugin={props}
                    schema={ConfigSchema}
                    defaultTitle={i18n.t('CHAP · Prediction Map')}
                    getItemTitle={(config) => config.title}
                    ConfigForm={ConfigForm}
                    View={WidgetView}
                />
            </ChapGuard>
        </ChapProvider>
    </QueryClientProvider>
)

export default Plugin

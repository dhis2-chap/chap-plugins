import { useChapSystemInfo } from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { type Config } from './config'
import styles from './WidgetView.module.css'

/**
 * Shown while the dashboard is in view mode. Replace this with the widget's
 * actual visualization — the template just proves the CHAP plumbing works.
 */
export const WidgetView = ({ config }: { config: Config }) => {
    const systemInfo = useChapSystemInfo()

    return (
        <div className={styles.view}>
            <h3>{config.title ?? i18n.t('Template widget')}</h3>
            <p>
                {i18n.t('Connected to chap-core {{version}}', {
                    version: systemInfo.data?.chap_core_version ?? '…',
                })}
            </p>
        </div>
    )
}

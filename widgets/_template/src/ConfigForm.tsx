import { type ConfigFormProps } from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { Button, InputField } from '@dhis2/ui'
import React, { useState } from 'react'
import { type Config } from './config'
import styles from './ConfigForm.module.css'

/**
 * Shown while the dashboard is in edit mode. Collect whatever this widget
 * needs and hand a schema-valid config to onSave.
 */
export const ConfigForm = ({
    config,
    onSave,
    isSaving,
}: ConfigFormProps<Config>) => {
    const [title, setTitle] = useState(config?.title ?? '')

    return (
        <div className={styles.form}>
            <InputField
                label={i18n.t('Widget title')}
                value={title}
                onChange={({ value }) => setTitle(value ?? '')}
            />
            <Button
                primary
                loading={isSaving}
                onClick={() =>
                    onSave({
                        version: 1,
                        widget: 'chap-widget-template',
                        title: title.trim() || undefined,
                    })
                }
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}

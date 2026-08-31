import { type ConfigFormProps } from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import { Button, InputField } from '@dhis2/ui'
import React, { useState } from 'react'
import { type Config } from './config'
import styles from './ConfigForm.module.css'

export const ConfigForm = ({
    config,
    onSave,
    isSaving,
}: ConfigFormProps<Config>) => {
    const [title, setTitle] = useState(config?.title ?? '')
    const [jobLimit, setJobLimit] = useState(String(config?.jobLimit ?? 8))

    const parsedJobLimit = Number(jobLimit)
    const canSave = Number.isInteger(parsedJobLimit) && parsedJobLimit > 0

    return (
        <div className={styles.form}>
            <InputField
                label={i18n.t('Number of recent jobs to show')}
                type="number"
                value={jobLimit}
                onChange={({ value }) => setJobLimit(value ?? '')}
            />
            <InputField
                label={i18n.t('Widget title (optional)')}
                value={title}
                onChange={({ value }) => setTitle(value ?? '')}
            />
            <Button
                primary
                loading={isSaving}
                disabled={!canSave}
                onClick={() =>
                    onSave({
                        version: 1,
                        widget: 'chap-widget-model-status',
                        title: title.trim() || undefined,
                        jobLimit: parsedJobLimit,
                    })
                }
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}

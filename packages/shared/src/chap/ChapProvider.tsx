import { useConfig } from '@dhis2/app-runtime'
import { CircularLoader } from '@dhis2/ui'
import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import { OpenAPI, ApiError } from '../chap-api'
import { enableQueue, getQueue } from '../chap-api/core/request'
import styles from '../plugin/states.module.css'

/**
 * Points the generated CHAP client at this instance's Route API and installs
 * a retry policy for the route's 503-under-concurrency behavior. Port of the
 * modeling app's SetChapUrl. Must wrap anything that calls a *Service class,
 * and must itself be inside a QueryClientProvider.
 */
export const ChapProvider = ({ children }: { children: React.ReactNode }) => {
    const { baseUrl } = useConfig()
    const [isReady, setIsReady] = useState(false)
    const queryClient = useQueryClient()

    useEffect(() => {
        OpenAPI.WITH_CREDENTIALS = true
        OpenAPI.BASE = `${baseUrl.replace(/\/$/, '')}/api/routes/chap/run`

        queryClient.setDefaultOptions({
            queries: {
                retry: (failureCount, error) => {
                    // The Route API 503s under concurrent load: retry while
                    // progressively throttling request concurrency
                    if (error instanceof ApiError && error.status > 500) {
                        const queue = getQueue()
                        if (queue === undefined) {
                            enableQueue({ concurrency: 2 })
                        }
                        if (
                            failureCount > 0 &&
                            queue &&
                            queue.concurrency !== 1
                        ) {
                            queue.concurrency = 1
                        }
                        return failureCount < 2
                    }
                    return false
                },
            },
        })
        setIsReady(true)
    }, [baseUrl, queryClient])

    if (!isReady) {
        return (
            <div className={styles.centeredState}>
                <CircularLoader />
            </div>
        )
    }

    return <>{children}</>
}

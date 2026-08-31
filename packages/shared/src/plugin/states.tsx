import { CircularLoader, NoticeBox } from '@dhis2/ui'
import React from 'react'
import styles from './states.module.css'

export const LoadingState = () => (
    <div className={styles.centeredState}>
        <CircularLoader />
    </div>
)

export const PassiveState = ({
    title,
    children,
}: {
    title: string
    children: React.ReactNode
}) => (
    <div className={styles.centeredState}>
        <div className={styles.noticeWrap}>
            <NoticeBox title={title}>{children}</NoticeBox>
        </div>
    </div>
)

export const ErrorState = ({
    title,
    children,
}: {
    title: string
    children: React.ReactNode
}) => (
    <div className={styles.centeredState}>
        <div className={styles.noticeWrap}>
            <NoticeBox error title={title}>
                {children}
            </NoticeBox>
        </div>
    </div>
)

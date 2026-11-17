import React, { useRef } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, ClipboardButton, Modal, useStyles2 } from '@grafana/ui';
import { ProblemDTO } from '../../datasource/types';

interface Props {
  problem: ProblemDTO;
  allowDangerousHTML?: boolean;
  onDismiss?(): void;
}

export const ProblemDescriptionModal = ({ problem, allowDangerousHTML, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);
  const contentRef = useRef<HTMLDivElement>(null);
  const hostNames = problem.hosts?.map((h) => h.name).join(', ');

  // For HTML descriptions copy the rendered text rather than the raw markup.
  const getText = () => {
    if (allowDangerousHTML && contentRef.current) {
      return contentRef.current.innerText || contentRef.current.textContent || problem.comments;
    }
    return problem.comments;
  };

  return (
    <Modal title="Problem description" isOpen={true} onDismiss={onDismiss} className={styles.modal}>
      <div className={styles.header}>
        <div className={styles.problemName}>{problem.name || problem.description}</div>
        {hostNames && <div className={styles.hosts}>{hostNames}</div>}
      </div>
      {allowDangerousHTML ? (
        <div
          ref={contentRef}
          className={styles.content}
          data-testid="problem-description-modal-content"
          dangerouslySetInnerHTML={{ __html: problem.comments }}
        />
      ) : (
        <div ref={contentRef} className={styles.content} data-testid="problem-description-modal-content">
          {problem.comments}
        </div>
      )}
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          Close
        </Button>
        <ClipboardButton icon="copy" variant="primary" getText={getText}>
          Copy to clipboard
        </ClipboardButton>
      </Modal.ButtonRow>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 800px;
    max-width: 90vw;
  `,
  header: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  problemName: css`
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  hosts: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  content: css`
    max-height: 60vh;
    overflow: auto;
    padding: ${theme.spacing(1.5, 2)};
    background: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    white-space: pre-wrap;
    word-break: break-word;
    line-height: ${theme.typography.body.lineHeight};
    user-select: text;
  `,
});

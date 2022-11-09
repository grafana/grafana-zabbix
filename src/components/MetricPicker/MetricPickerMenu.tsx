import { css, cx } from '@emotion/css';
import React, { FormEvent } from 'react';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { CustomScrollbar, getSelectStyles, Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { MENU_MAX_HEIGHT } from './constants';

interface Props {
  options: SelectableValue<string>[];
  onSelect: (option: SelectableValue<string>) => void;
  offset: { vertical: number; horizontal: number };
  minWidth?: number;
  selected?: number;
}

export const MetricPickerMenu = ({ options, offset, minWidth, selected, onSelect }: Props): JSX.Element => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles(minWidth));

  return (
    <div
      className={cx(
        styles.menu,
        customStyles.menuWrapper,
        { [customStyles.menuLeft]: offset.horizontal > 0 },
        css`
          bottom: ${offset.vertical > 0 ? `${offset.vertical}px` : 'unset'};
          top: ${offset.vertical < 0 ? `${Math.abs(offset.vertical)}px` : 'unset'};
        `
      )}
    >
      <div className={customStyles.menu} aria-label="Metric picker menu">
        <CustomScrollbar autoHide={false} autoHeightMax={`${MENU_MAX_HEIGHT}px`} hideHorizontalTrack>
          <div>
            <div className={styles.optionBody}>
              {options?.map((option, i) => (
                <MenuOption data={option} key={i} onClick={onSelect} isFocused={selected === i} hideDescription />
              ))}
            </div>
          </div>
        </CustomScrollbar>
      </div>
    </div>
  );
};

interface MenuOptionProps<T> {
  data: SelectableValue<string>;
  onClick: (value: SelectableValue<string>) => void;
  isFocused?: boolean;
  disabled?: boolean;
  hideDescription?: boolean;
}

const MenuOption = React.forwardRef<HTMLDivElement, React.PropsWithChildren<MenuOptionProps<any>>>(
  ({ data, isFocused, disabled, onClick, hideDescription }, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles());

    const wrapperClassName = cx(
      styles.option,
      customStyles.menuOptionWrapper,
      isFocused && styles.optionFocused,
      disabled && customStyles.menuOptionDisabled
    );

    const onClickInternal = (event: FormEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClick(data);
    };

    return (
      <div ref={ref} className={wrapperClassName} aria-label="Menu option" onClick={onClickInternal}>
        <div className={cx(styles.optionBody, customStyles.menuOptionBody)}>
          <span>{data.label || data.value}</span>
          {!hideDescription && data.description && <div className={styles.optionDescription}>{data.description}</div>}
        </div>
        {data.description && (
          <Tooltip content={data.description}>
            <Icon name="info-circle" className={customStyles.menuOptionInfoSign} />
          </Tooltip>
        )}
      </div>
    );
  }
);

MenuOption.displayName = 'MenuOption';

export const getStyles = (menuWidth?: number) => (theme: GrafanaTheme2) => {
  return {
    menuWrapper: css`
      display: flex;
      max-height: 650px;
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
      min-width: auto;
    `,
    menu: css`
      min-width: ${theme.spacing(menuWidth || 0)};

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    menuLeft: css`
      right: 0;
      flex-direction: row-reverse;
    `,
    container: css`
      padding: ${theme.spacing(1)};
      border: 1px ${theme.colors.border.weak} solid;
      border-radius: ${theme.shape.borderRadius(1)};
      background-color: ${theme.colors.background.primary};
      z-index: ${theme.zIndex.modal};
    `,
    menuOptionWrapper: css`
      padding: ${theme.spacing(0.5)};
    `,
    menuOptionBody: css`
      font-weight: ${theme.typography.fontWeightRegular};
      padding: ${theme.spacing(0, 1.5, 0, 0)};
    `,
    menuOptionDisabled: css`
      color: ${theme.colors.text.disabled};
      cursor: not-allowed;
    `,
    menuOptionInfoSign: css`
      color: ${theme.colors.text.disabled};
    `,
  };
};

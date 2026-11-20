import React from 'react';
import { Combobox as GrafanaCombobox, ComboboxOption } from '@grafana/ui';

type Props<T extends string | number> = Parameters<typeof GrafanaCombobox<T>>[0];

/**
 * Grafana's Combobox, minus a crash: when the typed text leaves fewer matches than the
 * position of the selected option, pressing Enter calls onChange with `undefined`
 * (downshift selects an item past the end of the filtered list), and handlers that read
 * `option.value` throw. Such calls are ignored, so the current value stays selected.
 */
export function Combobox<T extends string | number>(props: Props<T>) {
  const onChange = (option: ComboboxOption<T> | null) => {
    if (option !== undefined) {
      // null still reaches the handler, as Grafana sends it only when isClearable is set.
      (props.onChange as (option: ComboboxOption<T> | null) => void)(option);
    }
  };
  return <GrafanaCombobox {...props} onChange={onChange} />;
}

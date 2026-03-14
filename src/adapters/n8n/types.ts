export interface N8nItem<T = any> {
  json: T;
}

export interface N8nNodeAccessor<T = any> {
  first(): N8nItem<T>;
  all(): N8nItem<T>[];
}

export interface N8nSelector {
  (nodeName: string): N8nNodeAccessor;
}

export interface N8nInputAccessor {
  first(): N8nItem;
  all(): N8nItem[];
}

export interface N8nRuntime {
  $: N8nSelector;
  $input: N8nInputAccessor;
}

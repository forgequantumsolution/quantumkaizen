/**
 * Presentational contract for a canvas node renderer. jsPlumb owns node
 * positioning, dragging and connectivity (see `JsPlumbCanvas.tsx`); these
 * components only paint the card interior for a given kind.
 */
export interface NodeComponentProps<TData> {
  data: TData;
  selected?: boolean;
}

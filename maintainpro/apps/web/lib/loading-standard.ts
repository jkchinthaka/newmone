/**
 * One loading standard for the web app (see components/ui/loading.tsx):
 * - lists/tables: TableLoadingRows (skeleton rows, shown after LOADING_INDICATOR_DELAY_MS)
 * - full pages / route transitions: LoadingState (small spinner + text)
 * - buttons: ButtonSpinner inside a disabled button
 */
export const LOADING_INDICATOR_DELAY_MS = 250;
export const TABLE_LOADING_ROWS = 6;

/**
 * First load shows the skeleton; later loads (paging, filtering, refresh) keep the rows on screen.
 */
export function listLoadPhase(input: { loading: boolean; hasData: boolean; error: boolean }):
  | "initial"
  | "refreshing"
  | "error"
  | "ready" {
  if (input.error && !input.loading) return "error";
  if (input.loading) return input.hasData ? "refreshing" : "initial";
  return "ready";
}

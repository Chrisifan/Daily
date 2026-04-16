export function shouldShowBlockingAccountsLoading(
  loading: boolean,
  accountCount: number,
): boolean {
  return loading && accountCount === 0;
}

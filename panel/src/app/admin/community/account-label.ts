/** The admin identifies the account, so the display name comes first here. */
export function accountLabel(name: string | null, username: string | null): string {
  if (!name) return "Silinmiş kullanıcı";
  return username ? `${name} (@${username})` : name;
}

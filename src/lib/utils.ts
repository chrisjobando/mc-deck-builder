export const WARLOCK_ID = '21031a';

export function heroSlug(name: string, id: string): string {
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${nameSlug}-${id}`;
}

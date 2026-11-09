const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}

// Escapes text for safe use in HTML content and double-quoted attribute values.
// Apostrophes are left alone so copied email HTML stays readable.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, char => ENTITIES[char]!)
}

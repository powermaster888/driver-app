export function stripHtml(html: string | null | false): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}

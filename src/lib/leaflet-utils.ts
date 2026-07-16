/**
 * Injects the Leaflet CSS stylesheet and the map-ping keyframe animation
 * into the document head. Safe to call multiple times — idempotent.
 */
export function ensureLeafletCSS(): void {
  if (document.querySelector('link[data-leaflet-css]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  link.setAttribute('data-leaflet-css', '1')
  document.head.appendChild(link)

  if (!document.querySelector('style[data-map-anim]')) {
    const style = document.createElement('style')
    style.setAttribute('data-map-anim', '1')
    style.textContent =
      '@keyframes map-ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.8);opacity:0}}'
    document.head.appendChild(style)
  }
}

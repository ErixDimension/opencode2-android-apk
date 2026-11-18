// modelDisplayName.ts — N4.4.6 §1: nama model untuk tampilan saja.
// Buang prefix provider (segmen sebelum '/' terakhir); id penuh tetap dipakai
// untuk nilai ke server dan tersedia lewat atribut title di komponen.
export function modelDisplayName(id: string | null | undefined): string {
  if (!id) return ''
  const slash = id.lastIndexOf('/')
  if (slash < 0) return id
  return id.slice(slash + 1) || id
}

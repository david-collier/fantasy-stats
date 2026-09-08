import { useState } from 'react'

interface Props {
  src?: string
  size?: number
}

/** ESPN logo URLs are user-supplied and often dead; hide the image on error instead of showing a broken icon. */
export default function TeamLogo({ src, size = 24 }: Props) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <span className="logo-placeholder" style={{ width: size, height: size }} aria-hidden />
  return <img src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
}

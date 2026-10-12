import { ImageResponse } from 'next/og'
import fs from 'fs'
import path from 'path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const iconBuffer = fs.readFileSync(path.join(process.cwd(), 'public/brand/dice-cube-square.png'))
  const base64 = `data:image/png;base64,${iconBuffer.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          borderRadius: 36,
          padding: 16,
          overflow: 'hidden',
        }}
      >
        {/* Exact 3D cube render from user's asset */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={base64}
          alt="3MF Studio Icon"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size },
  )
}

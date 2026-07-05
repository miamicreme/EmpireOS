import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgb(8 9 12)',
          borderRadius: 7,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2 L21 7.5 V16.5 L12 22 L3 16.5 V7.5 Z"
            stroke="rgb(201 166 89)"
            strokeWidth="2"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}

import { Icon } from '../ui.js';

export function Splash({ out }: { out: boolean }) {
  return (
    <view className={`screen bg-dawn ${out ? 'a-leave-fade' : ''}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* the app logo: ink brackets on the dawn gradient (same art as the launcher icon) */}
      <view className="shadow-soft" style={{ width: '112px', height: '112px', borderRadius: '30px', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #B5D6D6 0%, #D5D9BC 30%, #EBD3A2 62%, #D6B7B1 100%)', animation: 'logoIn 700ms cubic-bezier(0.2,0.9,0.3,1) both' }}>
        <Icon name="logo" size={112} color="#161616" stroke={1.36} />
      </view>
      <text className="h1 a-rise d3" style={{ marginTop: '28px' }}>SalinLens</text>
      <text className="body a-rise d4" style={{ marginTop: '6px' }}>Scan it. Tidy it. Send it.</text>
      <view style={{ position: 'absolute', bottom: '72px', flexDirection: 'row' }} className="a-fade d5">
        {[0, 1, 2].map((i) => (
          <view key={i} style={{ width: '7px', height: '7px', borderRadius: '4px', backgroundColor: '#2A2926', margin: '0 4px', opacity: 0.35, animation: `shimmer 1000ms ease-in-out ${i * 180}ms infinite` }} />
        ))}
      </view>
    </view>
  );
}

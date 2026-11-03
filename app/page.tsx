import type { Metadata } from 'next';
import { FloatingHearts } from '@/components/landing/FloatingHearts';
import { StarField } from '@/components/landing/StarField';
import { CreateRoomButton } from '@/components/landing/CreateRoomButton';

export const metadata: Metadata = {
  title: 'CineTogether — Your Private Cinema for Two',
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const HOST_NAME = process.env.NEXT_PUBLIC_HOST_NAME || 'You';
const GUEST_NAME = process.env.NEXT_PUBLIC_GUEST_NAME || 'Your Person';

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center overflow-x-clip px-4 py-8 sm:px-6 sm:py-16">
      {/* Backgrounds */}
      <StarField />
      <FloatingHearts />

      {/* Deep gradient radial background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124, 58, 237, 0.15) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(236, 72, 153, 0.1) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Main content */}
      <div className="relative z-10 flex min-w-0 w-full max-w-lg flex-col items-center gap-6 text-center sm:gap-8">

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
          style={{
            background: 'rgba(168, 85, 247, 0.12)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            color: '#c4b5fd',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          Private Cinema for Two
        </div>

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl pulse-glow"
            style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(236, 72, 153, 0.2))',
              border: '1px solid rgba(168, 85, 247, 0.4)',
            }}
          >
            🎬
          </div>
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold gradient-text max-w-full break-words"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            CineTogether
          </h1>
        </div>

        {/* Personalized greeting */}
        <div className="w-full space-y-3 break-words">
          <p className="text-xl sm:text-2xl md:text-3xl font-light" style={{ color: '#f1f0ff' }}>
            Welcome back,{' '}
            <span className="gradient-text font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {HOST_NAME}
            </span>{' '}
            🌙
          </p>
          <p className="text-base md:text-lg leading-relaxed" style={{ color: '#9ca3af' }}>
            Ready to watch something beautiful with{' '}
            <span style={{ color: '#f472b6' }}>{GUEST_NAME}</span>?
            <br />
            Create a private room and share the magic.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { icon: '🔄', label: 'Perfect Sync' },
            { icon: '📱', label: 'Any Device' },
            { icon: '💬', label: 'Live Chat' },
            { icon: '🔒', label: 'Private Room' },
          ].map(({ icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#c4b5fd',
              }}
            >
              {icon} {label}
            </span>
          ))}
        </div>

        {/* CTA */}
        <CreateRoomButton backendUrl={BACKEND_URL} />

        {/* Footer note */}
        <p className="text-xs" style={{ color: '#6b7280' }}>
          No app download needed. Works on any browser. ✨
        </p>
      </div>

      {/* Decorative bottom gradient */}
      <div
        className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-0"
        style={{
          background: 'linear-gradient(to top, rgba(7,7,26,0.8), transparent)',
        }}
        aria-hidden="true"
      />
    </main>
  );
}

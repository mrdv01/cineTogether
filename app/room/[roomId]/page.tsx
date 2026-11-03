import { RoomClient } from '@/components/room/RoomClient';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ token?: string; role?: string }>;
}

export const metadata: Metadata = {
  title: 'Movie Night 🎬 — CineTogether',
  description: 'Your private cinema is ready. Enjoy the movie!',
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default async function RoomPage({ params, searchParams }: PageProps) {
  const { roomId } = await params;
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  return (
    <main className="min-h-screen overflow-hidden" style={{ background: '#07071a' }}>
      <RoomClient
        roomId={roomId}
        token={token}
        backendUrl={BACKEND_URL}
      />
    </main>
  );
}

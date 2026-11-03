'use client';

import { useEffect, useRef } from 'react';

interface Heart {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  emoji: string;
}

const EMOJIS = ['❤️', '💜', '🌙', '⭐', '✨', '💫', '🎬', '🍿'];

export function FloatingHearts() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const hearts: Heart[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 20 + 10,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    }));

    hearts.forEach((heart) => {
      const el = document.createElement('span');
      el.textContent = heart.emoji;
      el.style.cssText = `
        position: absolute;
        left: ${heart.x}%;
        bottom: -10%;
        font-size: ${heart.size}px;
        opacity: 0;
        pointer-events: none;
        user-select: none;
        animation: drift ${heart.duration}s ${heart.delay}s linear infinite;
        filter: blur(0.3px);
      `;
      container.appendChild(el);
    });

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}

import { useEffect, useRef, useState } from 'react';

// 共用 Phaser 挂载 hook：动态 import 引擎，组件卸载时销毁，避免主包膨胀。
// sceneFactory: (Phaser) => Phaser.Scene 实例（或 Scene 类）
export const usePhaserGame = ({ sceneFactory, width, height, backgroundColor = '#1e293b' }) => {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const module = await import('phaser');
        const Phaser = module.default ?? module;
        if (cancelled || !containerRef.current) return;
        const game = new Phaser.Game({
          type: Phaser.AUTO,
          width,
          height,
          parent: containerRef.current,
          backgroundColor,
          input: { keyboard: true },
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          scene: sceneFactory(Phaser),
        });
        gameRef.current = game;
        setLoading(false);
        const canvas = containerRef.current.querySelector('canvas');
        canvas?.setAttribute('tabindex', '0');
        canvas?.focus();
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err);
        }
      }
    })();
    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, gameRef, error, loading };
};

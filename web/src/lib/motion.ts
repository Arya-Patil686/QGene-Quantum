import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One animation loop for the whole app: Lenis is driven by the GSAP ticker
 * rather than its own rAF, so smooth scrolling and ScrollTrigger stay in phase.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (reducedMotion()) return;
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    const raf = (time: number) => lenis.raf(time * 1000);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);
}

/** Staggered entrance for every `.reveal` inside a container. */
export function useReveal(scope: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>('.reveal');
    if (!targets.length) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      targets.forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 26 },
          {
            opacity: 1, y: 0, duration: 0.75, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
      });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(targets, { opacity: 1, y: 0 });
    });
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

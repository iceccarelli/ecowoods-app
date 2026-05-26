export const springConfig = { type: 'spring', stiffness: 300, damping: 30 } as const;
export const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

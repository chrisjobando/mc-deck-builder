import { motion } from 'motion/react';

export default function MotionDemo() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <motion.div
        whileHover={{ scale: 1.06, rotate: -1 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        className="grid h-28 w-28 cursor-pointer place-items-center rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground shadow-md"
      >
        Hover me
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="grid h-28 w-28 place-items-center rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-md"
      >
        Float
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: '-20%' }}
        transition={{ duration: 0.45 }}
        className="grid h-28 w-28 place-items-center rounded-xl border border-border/60 bg-secondary text-sm font-medium text-secondary-foreground shadow-md"
      >
        On view
      </motion.div>
    </div>
  );
}

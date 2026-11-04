"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const GREETINGS = [
  { word: "Karibu", lang: "Swahili" },
  { word: "Bonjour", lang: "French" },
  { word: "Konnichiwa", lang: "Japanese" },
  { word: "Sawubona", lang: "Zulu" },
  { word: "Olá", lang: "Portuguese" },
  { word: "Namaste", lang: "Hindi" },
  { word: "Marhaba", lang: "Arabic" },
  { word: "Ciao", lang: "Italian" },
  { word: "Hola", lang: "Spanish" },
] as const;

/** Big handwritten "hello" that cycles through the world's languages. Purely decorative. */
export function HeroGreeting() {
  const reduceMotion = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % GREETINGS.length), 2600);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const current = GREETINGS[index] ?? GREETINGS[0];

  return (
    <div aria-hidden="true" className="relative h-28 sm:h-40">
      <AnimatePresence mode="wait">
        <motion.p
          key={current.word}
          initial={reduceMotion ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24, filter: "blur(8px)" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <span className="text-gradient block font-script text-7xl leading-none sm:text-9xl">{current.word}</span>
          <span className="mt-1 block text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            {current.lang} · hello
          </span>
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

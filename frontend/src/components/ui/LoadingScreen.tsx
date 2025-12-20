import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingScreenProps {
  onLoadingComplete?: () => void;
  minDuration?: number;
}

// Generate particles once at module level (not during render)
function generateParticles() {
  return Array.from({ length: 20 }, (_, i) => ({
    id: i,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 2,
    size: 4 + Math.random() * 8,
    x: Math.random() * 100,
    y: 60 + Math.random() * 40,
  }));
}

// Floating particle component
function Particle({ delay, duration, size, x, y }: {
  delay: number;
  duration: number;
  size: number;
  x: number;
  y: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full bg-gradient-to-br from-amber-400/30 to-amber-600/20"
      style={{ width: size, height: size, left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.6, 0.4, 0.6, 0],
        scale: [0, 1, 1.2, 1, 0],
        y: [0, -30, -60, -90, -120],
        x: [0, 10, -10, 5, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

// Orbiting dot component
function OrbitDot({ index, total }: { index: number; total: number }) {
  const angle = (index / total) * 360;

  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full bg-amber-400"
      style={{
        left: "50%",
        top: "50%",
        marginLeft: -4,
        marginTop: -4,
      }}
      animate={{
        rotate: [angle, angle + 360],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-amber-400"
        style={{ transform: "translateX(60px)" }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          delay: index * 0.2,
        }}
      />
    </motion.div>
  );
}

// Letter animation component
function AnimatedLetter({ letter, index }: { letter: string; index: number }) {
  return (
    <motion.span
      className="inline-block"
      initial={{ opacity: 0, y: 50, rotateX: -90 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{
        duration: 0.6,
        delay: 0.8 + index * 0.08,
        type: "spring",
        stiffness: 100,
        damping: 12,
      }}
    >
      <motion.span
        className="inline-block"
        animate={{
          color: ["hsl(40, 91%, 55%)", "hsl(40, 91%, 65%)", "hsl(40, 91%, 55%)"],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: index * 0.1,
        }}
      >
        {letter}
      </motion.span>
    </motion.span>
  );
}

export function LoadingScreen({ onLoadingComplete, minDuration = 2500 }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  // Mouse tracking for interactive gradient
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    setMousePosition({ x, y });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // Progress animation
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / minDuration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsComplete(true);
          onLoadingComplete?.();
        }, 300);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [minDuration, onLoadingComplete]);

  const companyName = "WelBuilt";
  const tagline = "AI Solutions";

  // Generate random particles - using useState with lazy initialization
  const [particles] = useState(generateParticles);

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {/* Animated background */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 transition-all duration-300"
            style={{
              background: `
                radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(245, 166, 35, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 20% 80%, rgba(245, 166, 35, 0.1) 0%, transparent 40%),
                radial-gradient(circle at 80% 20%, rgba(45, 74, 94, 0.2) 0%, transparent 40%),
                linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)
              `
            }}
          />

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(245, 166, 35, 0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(245, 166, 35, 0.5) 1px, transparent 1px)
              `,
              backgroundSize: "50px 50px",
            }}
          />

          {/* Floating particles */}
          {particles.map((particle) => (
            <Particle key={particle.id} {...particle} />
          ))}

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo container with orbit */}
            <div className="relative mb-8">
              {/* Orbiting dots */}
              {[0, 1, 2, 3].map((i) => (
                <OrbitDot key={i} index={i} total={4} />
              ))}

              {/* Pulsing glow */}
              <motion.div
                className="absolute inset-0 rounded-full bg-amber-500/20 blur-3xl"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ width: 150, height: 150, left: -35, top: -35 }}
              />

              {/* Logo */}
              <motion.div
                className="relative"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 100,
                  damping: 15,
                  delay: 0.2,
                }}
              >
                <motion.img
                  src="/images/logo-symbol.png"
                  alt="WelBuilt"
                  className="w-20 h-20 object-contain relative z-10"
                  animate={{
                    y: [0, -5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>
            </div>

            {/* Company name with letter animation */}
            <div className="text-4xl md:text-5xl font-bold mb-2 perspective-1000">
              {companyName.split("").map((letter, index) => (
                <AnimatedLetter
                  key={index}
                  letter={letter}
                  index={index}
                />
              ))}
            </div>

            {/* Tagline */}
            <motion.div
              className="text-lg text-amber-400/80 font-medium tracking-widest uppercase mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              {tagline}
            </motion.div>

            {/* Progress bar */}
            <div className="w-64 md:w-80">
              <div className="relative h-1 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: [-80, 320] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>

              {/* Progress text */}
              <motion.div
                className="flex justify-between items-center mt-3 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span className="text-slate-400">Loading</span>
                <motion.span
                  className="text-amber-400 font-mono"
                  key={Math.floor(progress)}
                >
                  {Math.floor(progress)}%
                </motion.span>
              </motion.div>
            </div>

            {/* Loading dots */}
            <motion.div
              className="flex gap-1.5 mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-amber-400"
                  animate={{
                    y: [0, -8, 0],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* Corner decorations */}
          <motion.div
            className="absolute top-8 left-8 w-20 h-20 border-l-2 border-t-2 border-amber-500/30 rounded-tl-3xl"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          />
          <motion.div
            className="absolute bottom-8 right-8 w-20 h-20 border-r-2 border-b-2 border-amber-500/30 rounded-br-3xl"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          />

          {/* Version/copyright */}
          <motion.div
            className="absolute bottom-6 text-xs text-slate-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            © 2024 WelBuilt AI Solutions
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Simple loading spinner for inline use
export function LoadingSpinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={`relative ${sizes[size]} ${className}`}>
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-amber-500/20"
      />
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-500"
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

export default LoadingScreen;

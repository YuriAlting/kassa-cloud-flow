import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-primary/8 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-10 max-w-md relative z-10"
      >
        <div className="space-y-3">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-5xl md:text-6xl font-extrabold text-primary tracking-tight"
          >
            AIA Kassa
          </motion.h1>
          <p className="text-muted-foreground text-lg">Made by AI Amsterdam</p>
        </div>

        <div className="space-y-4 w-full max-w-xs mx-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30"
          >
            Inloggen
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/admin')}
            className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-medium border border-border transition-colors hover:bg-secondary/80"
          >
            Superadmin
          </motion.button>
          <p className="text-sm text-muted-foreground pt-2">Welkom Terug!</p>
        </div>
      </motion.div>
    </div>
  );
}

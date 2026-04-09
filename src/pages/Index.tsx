import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-8 max-w-lg"
      >
        <div>
          <h1 className="text-4xl font-bold text-primary">KassaCloud</h1>
          <p className="text-muted-foreground mt-2">Multi-tenant Restaurant POS Platform</p>
        </div>

        <div className="space-y-3 w-full max-w-xs mx-auto">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
            className="touch-target w-full py-4 rounded-lg bg-primary text-primary-foreground font-semibold text-lg"
          >
            Inloggen
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/admin')}
            className="touch-target w-full py-3 rounded-lg bg-secondary text-secondary-foreground font-medium"
          >
            Superadmin
          </motion.button>
          <p className="text-sm text-muted-foreground">
            POS terminals: <code className="text-foreground">/pos/[slug]</code>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

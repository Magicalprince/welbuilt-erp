import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import type { User, UserRole } from "@/types";

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      firebaseUser: null,
      isLoading: true,
      error: null,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;

          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() } as User;
            set({ user: userData, firebaseUser, isLoading: false });
          } else {
            // Fallback only for founders who predate the users collection
            const basicUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "Founder",
              email: firebaseUser.email || email,
              equityPercent: 33,
              role: "FOUNDER" as UserRole,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            set({ user: basicUser, firebaseUser, isLoading: false });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Login failed";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await signOut(auth);
          set({ user: null, firebaseUser: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Logout failed";
          set({ error: errorMessage });
          throw error;
        }
      },

      resetPassword: async (email: string) => {
        try {
          set({ isLoading: true, error: null });
          await sendPasswordResetEmail(auth, email);
          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Password reset failed";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      setUser: (user) => set({ user }),
      setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
      setLoading: (isLoading) => set({ isLoading }),
      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }),
    }
  )
);

// Initialize auth listener
export const initAuthListener = () => {
  const { setFirebaseUser, setUser, setLoading } = useAuthStore.getState();

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      setFirebaseUser(firebaseUser);
      // Get user data from Firestore
      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: userDoc.id, ...userDoc.data() } as User);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    } else {
      setFirebaseUser(null);
      setUser(null);
    }
    setLoading(false);
  });
};

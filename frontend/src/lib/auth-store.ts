import { create } from 'zustand';

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${60 * 60 * 24 * 7};SameSite=Lax`;
}

function removeCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0`;
}

interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; email: string; name: string } | null;
  login: (accessToken: string, refreshToken: string, user: { id: string; email: string; name: string }) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  login: (accessToken, refreshToken, user) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    setCookie('accessToken', accessToken);
    set({ isAuthenticated: true, user });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    removeCookie('accessToken');
    set({ isAuthenticated: false, user: null });
  },
  hydrate: () => {
    const token = localStorage.getItem('accessToken');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        setCookie('accessToken', token);
        set({ isAuthenticated: true, user: JSON.parse(userStr) });
      } catch {
        set({ isAuthenticated: false, user: null });
      }
    }
  },
}));

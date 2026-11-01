import type {
  LoginRequest,
  RegisterRequest,
  SessionResponse,
  UserDto,
} from "@editflow/shared";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api/client";

type AuthContextValue = {
  user: UserDto | null;
  isLoading: boolean;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    const handleUnauthorized = () => {
      setUser(null);
      setIsLoading(false);
    };

    window.addEventListener("editflow:unauthorized", handleUnauthorized);

    authApi
      .me()
      .then((response: SessionResponse) => {
        if (isCurrent) {
          setUser(response.user);
        }
      })
      .catch(() => {
        // A 401 is expected for signed-out visitors. Network failures also
        // leave the visitor signed out without blocking the landing page.
        if (isCurrent) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
      window.removeEventListener("editflow:unauthorized", handleUnauthorized);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: async (input) => {
        const response = await authApi.login(input);
        setUser(response.user);
      },
      register: async (input) => {
        const response = await authApi.register(input);
        setUser(response.user);
      },
      logout: async () => {
        await authApi.logout();
        setUser(null);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

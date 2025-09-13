import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User, RegisterData, LoginData, ForgotPasswordData, ResetPasswordData } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}

export function useRegister() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: RegisterData) => {
      return apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: () => {
      // Refetch user data after successful registration
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: LoginData) => {
      return apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: () => {
      // Refetch user data after successful login
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Clear user data after logout
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      return apiRequest("POST", "/api/auth/forgot-password", data);
    },
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      return apiRequest("POST", "/api/auth/reset-password", data);
    },
    onSuccess: () => {
      // Clear any cached user data after password reset
      queryClient.clear();
    },
  });
}
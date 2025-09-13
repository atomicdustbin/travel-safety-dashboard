import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useResetPassword } from "@/hooks/useAuth";
import { resetPasswordSchema, type ResetPasswordData } from "@shared/schema";
import { Globe, CheckCircle } from "lucide-react";

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const { toast } = useToast();
  const resetPasswordMutation = useResetPassword();

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordData) => {
    try {
      await resetPasswordMutation.mutateAsync(data);
      toast({
        title: "Password reset successful",
        description: "Your password has been updated. You can now sign in with your new password.",
      });
    } catch (error: any) {
      toast({
        title: "Password reset failed",
        description: error.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show success state after successful reset
  if (resetPasswordMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-primary mr-2" />
              <h1 className="text-2xl font-bold text-foreground">Global Advisor</h1>
            </div>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <CardTitle className="text-2xl text-center">Password Reset Successful</CardTitle>
              <CardDescription className="text-center">
                Your password has been successfully updated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  You can now sign in to your account using your new password.
                </p>
                <Button
                  onClick={() => window.location.href = "/"}
                  className="w-full"
                  data-testid="button-back-to-login"
                >
                  Continue to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Globe className="w-8 h-8 text-primary mr-2" />
            <h1 className="text-2xl font-bold text-foreground">Global Advisor</h1>
          </div>
          <p className="text-muted-foreground">
            Create your new password
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
            <CardDescription className="text-center">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="Enter your new password"
                  data-testid="input-reset-password"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reset-confirmPassword">Confirm New Password</Label>
                <Input
                  id="reset-confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  data-testid="input-reset-confirmPassword"
                  {...form.register("confirmPassword")}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordMutation.isPending}
                data-testid="button-reset-password"
              >
                {resetPasswordMutation.isPending ? "Updating Password..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
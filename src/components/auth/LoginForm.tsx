"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Step = "password" | "code";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function backToPassword() {
    setStep("password");
    setOtp("");
    setUseRecoveryCode(false);
    setError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        ...(step === "code" ? { otp } : {}),
        redirect: false,
      });

      if (!result?.error) {
        router.push(callbackUrl);
        router.refresh();
        return;
      }

      switch (result.code) {
        case "otp_required":
          setStep("code");
          break;
        case "invalid_otp":
          setOtp("");
          setError(
            useRecoveryCode
              ? "That recovery code didn't work. Each code can only be used once."
              : "That code didn't work. Enter the current code from your authenticator app.",
          );
          break;
        case "rate_limited":
          setError("Too many sign-in attempts. Wait a few minutes and try again.");
          break;
        default:
          backToPassword();
          setError("Invalid email or password. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {step === "password" ? "Welcome back" : "Two-factor check"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === "password" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="otp">
                {useRecoveryCode ? "Recovery code" : "Code from your authenticator app"}
              </Label>
              <Input
                id="otp"
                key={useRecoveryCode ? "recovery" : "totp"}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode={useRecoveryCode ? "text" : "numeric"}
                pattern={useRecoveryCode ? undefined : "[0-9]{6}"}
                maxLength={useRecoveryCode ? 11 : 6}
                placeholder={useRecoveryCode ? "ABCDE-FGHIJ" : "123456"}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0 text-muted-foreground"
                onClick={() => {
                  setUseRecoveryCode((v) => !v);
                  setOtp("");
                  setError(null);
                }}
                disabled={isLoading}
              >
                {useRecoveryCode ? "Use authenticator app code" : "Use a recovery code instead"}
              </Button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in…" : step === "password" ? "Sign in" : "Verify"}
          </Button>

          {step === "code" && (
            <Button type="button" variant="ghost" className="w-full" onClick={backToPassword} disabled={isLoading}>
              Back
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TwoFactorEnableResult, TwoFactorSetup, TwoFactorStatus } from "@/types/twoFactor";

type View = "loading" | "off" | "setup" | "recovery" | "on";

async function postJson<T>(url: string, body?: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json()) as T & { error?: string } };
}

export function TwoFactorCard() {
  const [view, setView] = useState<View>("loading");
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/user/two-factor");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as TwoFactorStatus;
      setStatus(data);
      setView(data.enabled ? "on" : "off");
    } catch {
      setError("Couldn't load two-factor status.");
      setView("off");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  function resetForm() {
    setCode("");
    setPassword("");
    setError(null);
  }

  async function startSetup() {
    resetForm();
    setIsBusy(true);
    try {
      const { ok, data } = await postJson<TwoFactorSetup>("/api/user/two-factor/setup");
      if (!ok) {
        setError(data.error ?? "Couldn't start setup.");
        return;
      }
      setSetup(data);
      setView("setup");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmSetup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const { ok, data } = await postJson<TwoFactorEnableResult>("/api/user/two-factor/enable", { code });
      if (!ok) {
        setError(data.error ?? "Couldn't turn on two-factor login.");
        setCode("");
        return;
      }
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      resetForm();
      setView("recovery");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const { ok, data } = await postJson<{ success: boolean }>("/api/user/two-factor/disable", { password, code });
      if (!ok) {
        setError(data.error ?? "Couldn't turn off two-factor login.");
        setCode("");
        return;
      }
      toast.success("Two-factor login turned off.");
      resetForm();
      await loadStatus();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      toast.success("Recovery codes copied.");
    } catch {
      toast.error("Couldn't copy. Select the codes and copy them by hand.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-Factor Login
          {view === "on" && <ShieldCheck className="h-4 w-4 text-primary" aria-label="On" />}
        </CardTitle>
        <CardDescription>
          Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy…) after your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {view === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}

        {view === "off" && (
          <Button onClick={startSetup} disabled={isBusy}>
            {isBusy ? "Starting…" : "Set up two-factor login"}
          </Button>
        )}

        {view === "setup" && setup && (
          <form onSubmit={confirmSetup} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              1. Scan this QR code with your authenticator app.
            </p>
            {/* QR codes need a white background to scan, whatever the theme */}
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`}
              alt="QR code for your authenticator app"
              className="h-48 w-48 rounded-md bg-white p-2"
            />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Can&apos;t scan? Enter this key instead:</p>
              <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
                {setup.secret.match(/.{1,4}/g)?.join(" ")}
              </code>
            </div>
            <div className="space-y-1">
              <Label htmlFor="setupCode">2. Enter the 6-digit code the app shows</Label>
              <Input
                id="setupCode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="123456"
                disabled={isBusy}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={isBusy}>
                {isBusy ? "Checking…" : "Turn on"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSetup(null);
                  resetForm();
                  setView("off");
                }}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {view === "recovery" && (
          <div className="space-y-4">
            <p className="text-sm">
              Two-factor login is on. Save these recovery codes somewhere safe, like a password manager.
              Each one signs you in once if you lose your phone.{" "}
              <strong>They won&apos;t be shown again.</strong>
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyRecoveryCodes}>
                Copy codes
              </Button>
              <Button
                onClick={() => {
                  setRecoveryCodes([]);
                  void loadStatus();
                }}
              >
                I&apos;ve saved them
              </Button>
            </div>
          </div>
        )}

        {view === "on" && (
          <form onSubmit={disable} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Two-factor login is on. {status?.recoveryCodesRemaining ?? 0} recovery codes left.
            </p>
            <p className="text-sm font-medium">Turn off two-factor login</p>
            <div className="space-y-1">
              <Label htmlFor="disablePassword">Password</Label>
              <Input
                id="disablePassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isBusy}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="disableCode">Authenticator or recovery code</Label>
              <Input
                id="disableCode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
                disabled={isBusy}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="destructive" disabled={isBusy}>
              {isBusy ? "Turning off…" : "Turn off"}
            </Button>
          </form>
        )}

        {view === "off" && error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck,
  ShieldOff,
  QrCode,
  Copy,
  Check,
  Loader2,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

type Step = "status" | "qr" | "verify" | "backup" | "disable";

export default function SecurityPage() {
  const [step, setStep] = useState<Step>("status");
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Setup state
  const [qrCode, setQrCode] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState(["", "", "", "", "", ""]);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable state
  const [disableCode, setDisableCode] = useState("");

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check 2FA status on mount
  useEffect(() => {
    check2FAStatus();
  }, []);

  const check2FAStatus = async () => {
    try {
      const res = await fetch("/api/admin/2fa/status");
      const data = await res.json();
      if (res.ok) {
        setIs2FAEnabled(data.enabled);
      }
    } catch {
      toast.error("Failed to check 2FA status");
    } finally {
      setLoading(false);
    }
  };

  // Focus first input when verify step appears
  useEffect(() => {
    if (step === "verify" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  const handleSetup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/2fa/setup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setQrCode(data.qrCode);
      setManualSecret(data.secret);
      setStep("qr");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start 2FA setup");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...verifyCode];
    newCode[index] = value.slice(-1);
    setVerifyCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !verifyCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newCode = [...verifyCode];
    for (let i = 0; i < 6; i++) newCode[i] = pasted[i] || "";
    setVerifyCode(newCode);
    const next = newCode.findIndex((c) => !c);
    inputRefs.current[next === -1 ? 5 : next]?.focus();
  };

  const handleVerifyAndEnable = async () => {
    const code = verifyCode.join("");
    if (code.length < 6) {
      toast.error("Enter the full 6-digit code");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setBackupCodes(data.backupCodes);
      setIs2FAEnabled(true);
      setStep("backup");
      toast.success("2FA enabled successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      setVerifyCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disableCode.trim()) {
      toast.error("Enter your authenticator or backup code");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setIs2FAEnabled(false);
      setDisableCode("");
      setStep("status");
      toast.success("2FA has been disabled");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: "secret" | "codes") => {
    navigator.clipboard.writeText(text);
    if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
    toast.success("Copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Security Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage two-factor authentication for your admin account
        </p>
      </div>

      {/* Status Card */}
      {step === "status" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                is2FAEnabled
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-amber-100 text-amber-600"
              }`}
            >
              {is2FAEnabled ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <ShieldOff className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {is2FAEnabled
                  ? "2FA is enabled. Your account is protected with Google Authenticator."
                  : "2FA is not enabled. Add an extra layer of security to your admin account."}
              </p>

              <div className="mt-4">
                {is2FAEnabled ? (
                  <button
                    onClick={() => setStep("disable")}
                    className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Disable 2FA
                  </button>
                ) : (
                  <button
                    onClick={handleSetup}
                    disabled={actionLoading}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    Enable 2FA
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Step */}
      {step === "qr" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Scan QR Code
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Open Google Authenticator and scan this QR code
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="rounded-xl bg-white p-4">
              <img
                src={qrCode}
                alt="2FA QR Code"
                className="h-48 w-48"
              />
            </div>
          </div>

          {/* Manual Secret */}
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-2">
              Can&apos;t scan? Enter this key manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-foreground break-all">
                {manualSecret}
              </code>
              <button
                onClick={() => copyToClipboard(manualSecret, "secret")}
                className="shrink-0 rounded-lg p-2 hover:bg-accent transition-colors"
                title="Copy secret"
              >
                {copiedSecret ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          <button
            onClick={() => setStep("verify")}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            I&apos;ve scanned the code — Continue
          </button>

          <button
            onClick={() => { setStep("status"); setQrCode(""); setManualSecret(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Verify Step */}
      {step === "verify" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Verify Setup
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {/* Code inputs */}
          <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
            {verifyCode.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                className="h-12 w-11 rounded-lg border border-border bg-background text-center text-xl font-bold text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            ))}
          </div>

          <button
            onClick={handleVerifyAndEnable}
            disabled={actionLoading || verifyCode.join("").length < 6}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verify & Enable 2FA
          </button>

          <button
            onClick={() => { setStep("qr"); setVerifyCode(["", "", "", "", "", ""]); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to QR code
          </button>
        </div>
      )}

      {/* Backup Codes Step */}
      {step === "backup" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              2FA Enabled!
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Save these backup codes in a safe place. Each code can only be used once.
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> These codes won&apos;t be shown again. If you lose access to your
              authenticator app, use one of these codes to sign in.
            </p>
          </div>

          {/* Codes grid */}
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, i) => (
              <div
                key={i}
                className="rounded-lg bg-muted/50 py-2.5 px-4 text-center font-mono text-sm text-foreground tracking-wider"
              >
                {code}
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              copyToClipboard(backupCodes.join("\n"), "codes")
            }
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            {copiedCodes ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copiedCodes ? "Copied!" : "Copy all codes"}
          </button>

          <button
            onClick={() => {
              setStep("status");
              setBackupCodes([]);
              setQrCode("");
              setManualSecret("");
              setVerifyCode(["", "", "", "", "", ""]);
            }}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            I&apos;ve saved my codes — Done
          </button>
        </div>
      )}

      {/* Disable Step */}
      {step === "disable" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <ShieldOff className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Disable 2FA
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your authenticator code or a backup code to disable 2FA
            </p>
          </div>

          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="Enter code"
              className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors font-mono tracking-wider"
              autoFocus
            />
          </div>

          <button
            onClick={handleDisable}
            disabled={actionLoading || !disableCode.trim()}
            className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldOff className="h-4 w-4" />
            )}
            Disable Two-Factor Authentication
          </button>

          <button
            onClick={() => { setStep("status"); setDisableCode(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Info */}
      <div className="rounded-xl border border-border bg-card/50 p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">
          About Two-Factor Authentication
        </h4>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Uses Google Authenticator (or any TOTP app) for verification</li>
          <li>• After logging in with your password, you&apos;ll enter a 6-digit code</li>
          <li>• Backup codes can be used if you lose access to your authenticator</li>
          <li>• Each backup code can only be used once</li>
        </ul>
      </div>
    </div>
  );
}

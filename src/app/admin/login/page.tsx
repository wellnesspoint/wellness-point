"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [totpCode, setTotpCode] = useState(["", "", "", "", "", ""]);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first TOTP input when 2FA step appears
  useEffect(() => {
    if (requires2FA && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [requires2FA]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Login failed");
      } else if (data.requires2FA) {
        setPendingToken(data.pendingToken);
        setRequires2FA(true);
        toast("Enter your authenticator code", { icon: "🔐" });
      } else {
        toast.success("Welcome to Admin Panel");
        router.push("/admin");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleTotpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newCode = [...totpCode];
    newCode[index] = value.slice(-1); // Only last digit
    setTotpCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleTotpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !totpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleTotpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newCode = [...totpCode];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || "";
    }
    setTotpCode(newCode);

    // Focus the next empty or the last one
    const nextEmpty = newCode.findIndex((c) => !c);
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = useBackupCode ? backupCode.trim() : totpCode.join("");
    if (!useBackupCode && code.length < 6) {
      toast.error("Enter the full 6-digit code");
      return;
    }
    if (useBackupCode && !code) {
      toast.error("Enter your backup code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Verification failed");
        setTotpCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        if (data.warning) {
          toast(data.warning, { icon: "⚠️", duration: 5000 });
        }
        toast.success("Welcome to Admin Panel");
        router.push("/admin");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequires2FA(false);
    setPendingToken("");
    setTotpCode(["", "", "", "", "", ""]);
    setUseBackupCode(false);
    setBackupCode("");
    setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
              {requires2FA ? (
                <KeyRound className="h-8 w-8 text-emerald-400" />
              ) : (
                <ShieldCheck className="h-8 w-8 text-emerald-400" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">
              {requires2FA ? "Two-Factor Auth" : "Admin Panel"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {requires2FA
                ? "Enter the code from your authenticator app"
                : "Wellness Point Administration"}
            </p>
          </div>

          {/* Login Form */}
          {!requires2FA ? (
            <form onSubmit={handleSubmit} className="space-y-5" suppressHydrationWarning>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter admin email"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-10 py-3 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                    autoComplete="email"
                    suppressHydrationWarning
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-10 py-3 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                    autoComplete="current-password"
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-emerald-600/25"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Authenticating...
                  </span>
                ) : (
                  "Sign In to Admin"
                )}
              </button>
            </form>
          ) : (
            /* 2FA Verification Form */
            <form onSubmit={handleVerify2FA} className="space-y-6">
              {!useBackupCode ? (
                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-300 text-center">
                    6-digit verification code
                  </label>
                  <div className="flex justify-center gap-2" onPaste={handleTotpPaste}>
                    {totpCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleTotpChange(index, e.target.value)}
                        onKeyDown={(e) => handleTotpKeyDown(index, e)}
                        className="h-12 w-11 rounded-lg bg-white/5 border border-white/10 text-center text-xl font-bold text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseBackupCode(true)}
                    className="mt-3 w-full text-xs text-slate-500 hover:text-emerald-400 transition-colors text-center"
                  >
                    Use a backup code instead
                  </button>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Backup Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      placeholder="Enter backup code"
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-10 py-3 text-white font-mono tracking-widest placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setUseBackupCode(false); setBackupCode(""); }}
                    className="mt-3 w-full text-xs text-slate-500 hover:text-emerald-400 transition-colors text-center"
                  >
                    Use authenticator code instead
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-emerald-600/25"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Verifying...
                  </span>
                ) : (
                  "Verify & Sign In"
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to login
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Back to Store
            </a>
          </div>
        </div>

        {/* Decorative */}
        <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Tab = "login" | "register";

export default function AuthModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("login");
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login, register } = useAuth();
  const { toast } = useToast();

  useBodyScrollLock(isOpen);

  const resetForm = () => {
    setAccountId("");
    setPassword("");
    setEmail("");
    setIsSubmitting(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !password) return;
    setErrorMessage(null);
    try {
      setIsSubmitting(true);
      await login(accountId, password);
      toast({
        title: "Login successful",
        description: `Welcome, ${accountId}!`,
      });
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      setErrorMessage(message);
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !password || !email) return;
    setErrorMessage(null);
    try {
      setIsSubmitting(true);
      await register(accountId, password, email);
      toast({
        title: "Sign up successful",
        description: `Welcome, ${accountId}! You're all set.`,
      });
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      setErrorMessage(message);
      toast({
        title: "Sign up failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = tab === "login" ? handleLogin : handleRegister;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black bg-opacity-70"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <Card className="w-full max-w-md rounded-2xl border-none shadow-2xl">
        <CardHeader className="relative bg-cat-orange/10 rounded-t-2xl">
          <CardTitle className="text-center text-2xl font-bold text-cat-brown">
            {tab === "login" ? "Login" : "Sign up"}
          </CardTitle>
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full p-1 hover:bg-cat-orange/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6 text-cat-brown" />
          </button>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-6 flex gap-2">
            <Button
              type="button"
              variant={tab === "login" ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setTab("login");
                setErrorMessage(null);
              }}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={tab === "register" ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setTab("register");
                setErrorMessage(null);
              }}
            >
              Sign up
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountId" className="text-cat-brown font-medium">
                Account ID
              </Label>
              <Input
                id="accountId"
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Enter your account ID"
                className="border-cat-orange/30 focus:border-cat-orange"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-cat-brown font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="border-cat-orange/30 focus:border-cat-orange"
                required
              />
            </div>

            {tab === "register" && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-cat-brown font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="border-cat-orange/30 focus:border-cat-orange"
                  required
                />
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-white hover:bg-primary/90 rounded-xl py-6 text-lg font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (tab === "login" ? "Signing in..." : "Signing up...")
                : tab === "login"
                  ? "Login"
                  : "Sign up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { User, LogOut, ImageIcon, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { changePassword, fetchUserDetails, type UserDetails } from "@/services/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/**
 * Profile popover shown when the user is logged in.
 * Renders User icon trigger + dropdown with email, joined date, and Log out.
 */
export default function ProfilePopover() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!profileOpen || !token) {
      setUserDetails(null);
      return;
    }
    setDetailsError(null);
    setDetailsLoading(true);
    fetchUserDetails()
      .then(setUserDetails)
      .catch((err: unknown) => {
        setDetailsError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setDetailsLoading(false));
  }, [profileOpen, token]);

  const resetPasswordForm = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setIsChangingPassword(false);
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    resetPasswordForm();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation must match.");
      return;
    }

    try {
      setIsChangingPassword(true);
      const result = await changePassword(oldPassword, newPassword);
      toast({
        title: "Password changed",
        description: result.message || "Password changed successfully.",
      });
      closePasswordModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to change password.";
      setPasswordError(message);
      toast({
        title: "Password change failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <>
      <Popover open={profileOpen} onOpenChange={setProfileOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center justify-center h-12 w-12 rounded-full bg-white/10 p-3 text-white hover:bg-primary hover:text-white transition-colors"
            aria-label="Profile"
          >
            <User className="h-6 w-6" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          className="w-64 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
        >
          <div className="space-y-3">
            {detailsLoading && <p className="text-sm text-gray-500">Loading...</p>}
            {detailsError && <p className="text-sm text-red-600">{detailsError}</p>}
            {!detailsLoading && !detailsError && userDetails && (
              <>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">
                      Account ID
                    </span>
                    <br />
                    {userDetails.accountId || user?.accountId || "—"}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">
                      Email
                    </span>
                    <br />
                    {userDetails.email}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">
                      Joined
                    </span>
                    <br />
                    {userDetails.joinedDate
                      ? new Date(userDetails.joinedDate).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )
                      : "—"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/gallery?mine=1");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                >
                  <ImageIcon className="h-4 w-4" />
                  My Photos
                </button>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    setPasswordModalOpen(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                >
                  <Lock className="h-4 w-4" />
                  Change Password
                </button>
                <button
                  onClick={() => {
                    logout();
                    setProfileOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePasswordModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Change Password
              </h2>
              <button
                onClick={closePasswordModal}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                aria-label="Close password modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-3">
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Current password"
                required
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                required
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />

              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isChangingPassword ||
                  !oldPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {isChangingPassword ? "Changing..." : "Confirm Change"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

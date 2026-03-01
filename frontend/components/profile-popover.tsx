"use client";

import { useState, useEffect } from "react";
import { User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserDetails, type UserDetails } from "@/services/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Profile popover shown when the user is logged in.
 * Renders User icon trigger + dropdown with email, joined date, and Log out.
 */
export default function ProfilePopover() {
  const { token, logout, refreshToken } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileOpen || !token) {
      setUserDetails(null);
      return;
    }
    setDetailsError(null);
    setDetailsLoading(true);
    fetchUserDetails(token)
      .then(setUserDetails)
      .catch(async (err: unknown) => {
        const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : undefined;
        if (status === 401) {
          const newToken = await refreshToken();
          if (newToken) {
            try {
              const details = await fetchUserDetails(newToken);
              setDetailsError(null);
              setUserDetails(details);
              return;
            } catch {
              setDetailsError("Failed to load");
            }
          } else {
            setDetailsError("Session expired. Please log in again.");
          }
        } else {
          setDetailsError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => setDetailsLoading(false));
  }, [profileOpen, token, refreshToken]);

  return (
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
          {detailsLoading && (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
          {detailsError && (
            <p className="text-sm text-red-600">{detailsError}</p>
          )}
          {!detailsLoading && !detailsError && userDetails && (
            <>
              <div className="space-y-1 text-sm">
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
  );
}

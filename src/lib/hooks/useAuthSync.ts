import { useState, useEffect, useMemo, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCloudDataSource, getLocalDataSource, type DataSource } from "@/lib/data-source";
import { localListConversations } from "@/lib/local-db";

export function useAuthSync() {
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [dataSource, setDataSource] = useState<DataSource>(() => getLocalDataSource());
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [localConvoCount, setLocalConvoCount] = useState(0);
  const prevSignedInRef = useRef(false);

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setAuthReady(true);
        setMode("local");
        setDataSource(getLocalDataSource());
        return;
      }

      // Handle Supabase PKCE redirect
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            url.searchParams.delete("code");
            window.history.replaceState({}, "", url.toString());
          }
        }
      } catch {
        // ignore
      }

      const { data } = await supabase.auth.getSession();
      setUserEmail(data.session?.user?.email ?? null);
      const signedIn = !!data.session;
      prevSignedInRef.current = signedIn;
      setMode(signedIn ? "cloud" : "local");
      setDataSource(signedIn ? getCloudDataSource() : getLocalDataSource());
      setAuthReady(true);

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUserEmail(session?.user?.email ?? null);
        const signedInNow = !!session;
        const wasSignedIn = prevSignedInRef.current;
        prevSignedInRef.current = signedInNow;
        setMode(signedInNow ? "cloud" : "local");
        setDataSource(signedInNow ? getCloudDataSource() : getLocalDataSource());

        if (!wasSignedIn && signedInNow) {
          localListConversations()
            .then((list) => {
              setLocalConvoCount(list.length);
              if (list.length > 0) setShowSyncPrompt(true);
            })
            .catch(() => {});
        }
      });

      return () => {
        sub.subscription.unsubscribe();
      };
    })();
  }, [supabase]);

  return {
    supabase,
    authReady,
    userEmail,
    mode,
    dataSource,
    showSyncPrompt,
    setShowSyncPrompt,
    localConvoCount,
  };
}

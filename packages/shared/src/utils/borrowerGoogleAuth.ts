import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { getBorrowerOAuthRedirectUrl } from "@phinduloans/shared/config/borrowerOAuth";

export async function startBorrowerGoogleOAuth(nextPath?: string | null): Promise<{ error: Error | null }> {
  const redirectTo = getBorrowerOAuthRedirectUrl(nextPath);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  return { error: error ? new Error(error.message) : null };
}

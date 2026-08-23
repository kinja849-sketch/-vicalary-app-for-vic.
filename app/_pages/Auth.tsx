"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { syncUserWithSupabase } from "@/lib/api/auth";
import { toast } from "sonner";
import { useTranslation } from "@/lib/api/translation";
import { Mail, Github, Chrome, Facebook, Phone, Apple } from "lucide-react";
import "./auth.css";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const handleSocialAuth = async (provider: 'google' | 'facebook') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePhoneAuth = () => {
    // Redirect to phone input or switch mode if implemented
    router.push("/phone-input");
  };

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      syncAndNavigate();
    }
  }, [user, authLoading]);

  const syncAndNavigate = async () => {
    try {
      console.log("[Auth] Starting profile sync for user:", user?.id);
      const profile = await syncUserWithSupabase(user);
      
      if (!profile) {
        console.error("[Auth] No profile returned after sync");
        router.push("/onboarding");
        return;
      }

      console.log("[Auth] Profile synced successfully:", {
        id: profile.id,
        name: profile.full_name,
        onboarding_completed: profile.onboarding_completed
      });

      if (profile.onboarding_completed) {
        console.log("[Auth] Returning user detected. Redirecting to dashboard.");
        toast.success(`${t('login_welcome')} ${profile.full_name || ''}`);
        router.push("/dashboard");
      } else {
        console.log("[Auth] New user or incomplete onboarding. Redirecting to onboarding.");
        router.push("/onboarding");
      }
    } catch (error: any) {
      console.error("[Auth] Sync and navigate failed:", error);
      toast.error("Failed to restore session. Please try again.");
      router.push("/onboarding");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setLoading(true);

      if (isSignUp) {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });

        const result = await response.json();
        if (!response.ok) {
          if (result.error?.includes("rate limit")) {
            throw new Error(t('rate_limit_exceeded'));
          }
          if (result.error?.includes("already registered") || result.error?.includes("already exists")) {
            throw new Error(t('already_account') || 'User already registered');
          }
          throw new Error(result.error || 'Signup failed');
        }

        toast.success(t('account_created_msg') || 'Check your email to verify your account!');
        setVerificationSent(true);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error(t('invalid_credentials'));
          }
          throw error;
        }

        if (data.user) {
          toast.success(t('login_welcome'));
          // Navigation happens via useEffect
        }
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      let errorMessage = error.message || t('auth_error');

      // Specific handling for Rate Limits (429)
      if (error.status === 429 || errorMessage.toLowerCase().includes("rate limit")) {
        errorMessage = t('rate_limit_exceeded');
      } 
      // Prevent technical API key errors from being shown to users
      else if (errorMessage.includes("Invalid API key") || errorMessage.includes("apiKey")) {
        errorMessage = t('auth_error') || "Authentication service error. Please try again later.";
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen w-full overflow-hidden p-0 sm:p-4">
      {/* Full screen background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-vic-green-start via-vic-green-start to-vic-green-end -z-10" />
      
      <div className={`main-container container ${isSignUp ? "active" : ""}`}>
        {/* Sign In Background */}
        <div className="bg-container sign-in-bg">
          <img
            className="bg-image"
            alt="Healthy salad bowl"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5ft470FPRGEKvlxsbk-7dbLtVNzqX48YmRIcRkMdn-VjLUaZ8Oggkyf79b6L0k3zXB9PJXsn7nQLKk7pSxXYp3cPfCB6-UEbHw9lRxKcAuSSGoyS0YyPUN7aZSZapm5732kFAZs8IrozqCptwWQt_fvQbZRtDVeu9NV8YXaLp1zUi5H5hbVlHtj24nhau6hAlAyULnHVQmVhGQJ2KHpXJ0kTTsDUjE09wNP1Fsem53gLxKABlZuFrqZ79nvVIck0PMDfnd1nYzEFp"
          />
          <div className="bg-overlay"></div>
        </div>

        {/* Sign Up Background */}
        <div className="bg-container sign-up-bg">
          <img
            className="bg-image"
            alt="Man jogging in park"
            src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=800&fit=crop"
          />
          <div className="bg-overlay"></div>
        </div>

        {/* Sign In Form */}
        <div className="form-container sign-in-container">
          <div className="flex w-full h-full items-center justify-center p-4 sm:p-8">
            <div className="w-full rounded-2xl form-card p-8 sm:p-10 text-center max-w-[400px] mx-auto shadow-2xl backdrop-blur-xl bg-white/10 border border-white/20">
              <div className="flex justify-center mb-4">
                <img src="/app logo.png" alt="Vicalary" className="h-14 w-14 object-contain rounded-full bg-white/10 p-1" />
              </div>
              <h1 className="text-white text-3xl font-bold tracking-tight">
                {t('welcome_back')}
              </h1>
              <p className="text-gray-200 mt-2 mb-6 sm:mb-8 text-base font-medium">
                {t('sign_in_desc')}
              </p>

              <div className="space-y-4">
                <form onSubmit={handleAuth} className="flex w-full flex-col items-center space-y-4">
                  <input
                    type="email"
                    placeholder={t('email_addr')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-vic-green"
                    required
                  />
                  <input
                    type="password"
                    placeholder={t('password_label')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-vic-green"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-full bg-vic-green px-5 py-3 text-base font-semibold text-slate-800 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {loading ? t('signing_in') : t('sign_in_email')}
                  </button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-transparent text-gray-400 uppercase tracking-widest text-[10px] font-bold">Or continue with</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleSocialAuth('google')}
                    className="flex items-center justify-center gap-3 py-3 w-full rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <Chrome size={20} className="text-white" />
                    <span className="text-white font-semibold">Continue with Google</span>
                  </button>
                </div>

                <div className="text-gray-200 text-sm mt-4 font-medium">
                  {t('new_here')}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(true);
                      setVerificationSent(false);
                    }}
                    className="text-accent-purple hover:underline font-semibold bg-transparent border-0 p-0 m-0 h-auto ml-1 hover:bg-white/20 px-2 py-1 rounded"
                  >
                    {t('sign_up_action')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sign Up Form */}
        <div className="form-container sign-up-container">
          <div className="flex w-full h-full items-center justify-center p-4 sm:p-8">
            <div className="w-full rounded-xl form-card p-6 sm:p-8 text-center max-w-sm mx-auto">
              <h1 className="text-white text-3xl font-bold tracking-tight">
                {verificationSent ? t('check_email') : t('create_account')}
              </h1>
              <p className="text-gray-200 mt-2 mb-6 sm:mb-8 text-sm font-medium">
                {verificationSent
                  ? t('sign_up_desc_verify')
                  : t('start_journey')}
              </p>

              <div className="space-y-4">
                {!verificationSent ? (
                  <>
                    <form onSubmit={handleAuth} className="flex w-full flex-col items-center space-y-4">
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-vic-green"
                        required
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-vic-green"
                        required
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-full bg-vic-green px-5 py-3 text-base font-semibold text-slate-800 hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {loading ? t('creating_account') : t('create_account')}
                      </button>
                    </form>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-transparent text-gray-400 uppercase tracking-widest text-[10px] font-bold">Or continue with</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => handleSocialAuth('google')}
                        className="flex items-center justify-center gap-3 py-3 w-full rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <Chrome size={20} className="text-white" />
                        <span className="text-white font-semibold">Continue with Google</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setVerificationSent(false)}
                    className="text-gray-300 text-sm hover:text-white transition-colors"
                  >
                    {t('back_to_sign_up')}
                  </button>
                )}

                {!verificationSent && (
                  <div className="text-gray-200 text-sm mt-4 font-medium">
                    {t('already_account')}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                      }}
                      className="text-accent-purple hover:underline font-semibold bg-transparent border-0 p-0 m-0 h-auto ml-1 hover:bg-white/20 px-2 py-1 rounded"
                    >
                      {t('sign_in')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

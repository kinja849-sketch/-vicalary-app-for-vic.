"use client"
import { useState, useRef } from "react";
import Link from "next/link"
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings, ImagePlus, Camera, CalendarDays, BadgeCheck, LogOut } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile, updateUserProfile, uploadAvatar } from "@/lib/api/auth";
import { useTranslation } from "@/lib/api/translation";
import { toast } from "sonner";
import { MyQRCode } from "@/components/MyQRCode";
import { getMyQRCodeData } from "@/lib/api/chat";

export default function Profile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, signOut } = useAuth();
  const { t, lang } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user profile from Supabase
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id
  });

  // Fetch QR Code data
  const { data: qrData } = useQuery({
    queryKey: ['qrData', user?.id],
    queryFn: () => getMyQRCodeData(user!.id),
    enabled: !!user?.id
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (updates: any) => updateUserProfile(user!.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success(t('save_success'));
    },
    onError: (error: any) => {
      toast.error(`${t('update_failed')}: ${error.message}`);
    }
  });

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(user!.id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success(t('avatar_success'));
    },
    onError: (error: any) => {
      toast.error(`${t('update_failed')}: ${error.message}`);
    }
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error: any) {
      toast.error(`${t('sign_out_failed')}: ${error.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatarMutation.mutate(file);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1418]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vic-green"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-[#0d1418] p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('not_authenticated')}</h1>
        <p className="mb-8 text-slate-600 dark:text-slate-400">{t('please_sign_in')}</p>
        <button onClick={() => router.push("/auth")} className="px-6 py-3 bg-vic-deep-blue text-white rounded-lg font-bold">{t('sign_in')}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto w-full bg-white dark:bg-[#0d1418]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 bg-white dark:bg-[#0d1418]">
        <Link href="/dashboard" className="flex items-center gap-2 text-vic-deep-blue dark:text-vic-green font-bold">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('profile')}</h1>
        <button onClick={() => router.push("/settings")} className="text-slate-600 dark:text-slate-400">
          <Settings size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-6 group">
            <div
              className="w-40 h-40 rounded-full border-[6px] border-vic-green bg-center bg-no-repeat bg-cover shadow-2xl overflow-hidden relative"
              style={{ backgroundImage: `url("${(profile as any)?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent((profile as any)?.full_name || user.user_metadata?.full_name || 'User')}&background=13ec37&color=fff&size=256`}")` }}
            >
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <ImagePlus className="text-white" size={36} />
              </div>
            </div>

            {/* Upload Badge */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 size-10 bg-vic-green rounded-full border-4 border-white dark:border-[#0d1418] flex items-center justify-center shadow-xl cursor-pointer hover:scale-110 transition-transform z-20"
            >
              <Camera className="text-slate-900" size={18} />
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{(profile as any)?.first_name ? `${(profile as any).first_name} ${(profile as any).last_name || ''}` : (user.user_metadata?.full_name || "User")}</h2>
          <p className="text-slate-600 dark:text-slate-400">{(profile as any)?.email || user.email}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 dark:bg-[#1f2c34] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 mb-1">{t('current_weight')}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{(profile as any)?.weight_kg || "--"} kg</p>
          </div>
          <div className="bg-slate-50 dark:bg-[#1f2c34] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 mb-1">{t('goal')}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{profile?.goal_calories || "--"}</p>
          </div>
        </div>

        {/* Info List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1f2c34] rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <CalendarDays className="text-vic-green" size={20} />
              <span className="font-medium text-slate-900 dark:text-white">{t('member_since')}</span>
            </div>
            <span className="text-slate-600 dark:text-slate-400">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(lang || 'en') : t('today')}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1f2c34] rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <BadgeCheck className="text-vic-green" size={20} />
              <span className="font-medium text-slate-900 dark:text-white">{t('account_status')}</span>
            </div>
            <span className="text-vic-green font-bold">{t('verified')}</span>
          </div>
        </div>

        {/* My QR Code Section */}
        {qrData && (
          <div className="mt-8">
            <MyQRCode data={qrData} fullName={(profile as any)?.full_name || user.user_metadata?.full_name} />
          </div>
        )}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full mt-12 px-6 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          {t('sign_out')}
        </button>
      </main>
    </div>
  );
}

"use client"
import Link from "next/link";
import { useTranslation } from "@/lib/api/translation";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-[#0d1418] text-slate-900 dark:text-slate-100">
            <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 bg-white dark:bg-[#0d1418]">
                <Link
                    href="/settings"
                    className="flex items-center gap-2 text-vic-deep-blue dark:text-vic-green font-bold hover:opacity-70 transition-opacity"
                >
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-xl font-bold flex-1 text-center">
                    {t('privacy_policy')}
                </h1>
                <div className="w-6" />
            </header>

            <main className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
                <div className="prose dark:prose-invert max-w-none">
                    <h1 className="text-3xl font-extrabold mb-2">Privacy Policy</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 italic">
                        VicCalary – AI-Powered Nutrition & Spiritual Wellness Application
                        <br />
                        Effective Date: {new Date().toLocaleDateString()}
                    </p>

                    <p className="mb-6 leading-relaxed">
                        VicCalary (“we,” “our,” “us,” or “the Application”) is committed to protecting your privacy and ensuring transparency regarding how your personal information is collected, used, stored, and safeguarded. This Privacy Policy explains in detail how data is handled when you use VicCalary’s services, including AI-powered food analysis, real-time chat, calling features, spiritual content delivery, progress tracking, and other integrated functionalities.
                    </p>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">1. Information We Collect</h2>
                        <p className="mb-4">We collect information necessary to provide a personalized, secure, and fully functional experience. The data collected includes:</p>

                        <div className="space-y-4">
                            <div>
                                <h3 className="font-bold text-vic-green mb-1">1.1 Personal Identification Information</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Full name (if provided)</li>
                                    <li>Verified mobile number</li>
                                    <li>Profile image/avatar</li>
                                    <li>Account credentials (managed securely via Supabase Authentication)</li>
                                    <li>Device information (limited to technical diagnostics)</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-vic-green mb-1">1.2 Health & Nutrition Data</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Weight, height, age, and gender (if voluntarily provided)</li>
                                    <li>Daily calorie goals</li>
                                    <li>Logged meals and scanned food products</li>
                                    <li>AI-analyzed food images</li>
                                    <li>Nutritional preferences and dietary restrictions</li>
                                    <li>Budget and transaction entries related to food purchases</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-vic-green mb-1">1.3 Chat & Communication Data</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Messages sent and received</li>
                                    <li>Voice notes, images, videos, and shared media</li>
                                    <li>Call metadata (timestamps, duration — not audio content unless required for technical processing)</li>
                                    <li>Read receipts and typing indicators</li>
                                    <li>Contact lists added via verified number or QR code</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-vic-green mb-1">1.4 Spiritual & Time-Based Data</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Location-based prayer time detection (via IP-based approximation)</li>
                                    <li>Interaction with Quranic verses or Hadith reminders</li>
                                    <li>Time-of-day engagement patterns</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-vic-green mb-1">1.5 AI Interaction Data</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Messages sent to the Health Coach AI</li>
                                    <li>Food images processed through OpenAI GPT-4o</li>
                                    <li>Context used to generate daily summaries</li>
                                </ul>
                            </div>
                        </div>
                        <p className="mt-4 text-sm text-slate-500 italic">We do not intentionally collect sensitive personal identifiers beyond what is necessary to operate the service.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">2. How We Use Your Information</h2>
                        <p className="mb-3">We use collected information strictly to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Provide AI-powered nutritional analysis</li>
                            <li>Generate personalized health insights and daily summaries</li>
                            <li>Enable secure messaging, voice, and video calling</li>
                            <li>Deliver contextual spiritual reminders</li>
                            <li>Improve performance, stability, and security</li>
                            <li>Maintain contact verification integrity</li>
                            <li>Enforce account safety and fraud prevention</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                        <p className="mt-3 font-bold text-vic-green">We do not sell your personal data.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">3. AI Processing & Automated Decision-Making</h2>
                        <p className="mb-3">VicCalary integrates OpenAI (GPT-4o) for:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>Food recognition and nutrition estimation</li>
                            <li>Health Coach responses</li>
                            <li>Daily summary generation</li>
                        </ul>
                        <p className="mb-3">AI-generated responses are based solely on user-provided input and logged application data. While we strive for high accuracy, AI outputs should not replace professional medical, financial, or religious authority. Users remain responsible for health-related decisions.</p>
                        <p>AI interactions may be processed through secure third-party infrastructure strictly for operational purposes.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">4. Data Storage & Security</h2>
                        <p className="mb-3">VicCalary uses Supabase infrastructure with:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>PostgreSQL database protected by Row Level Security (RLS)</li>
                            <li>Secure authentication</li>
                            <li>Encrypted API communication (HTTPS)</li>
                            <li>Controlled storage access for media uploads</li>
                            <li>Real-time presence with secure token validation</li>
                        </ul>
                        <p>We implement strict access controls to prevent unauthorized data access. However, no system is 100% immune from breaches. In the unlikely event of a security incident, users will be notified in accordance with applicable laws.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">5. Contact & Chat Privacy</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Conversations are visible only to intended participants.</li>
                            <li>AI Health Coach conversations are private per user.</li>
                            <li>Self-messaging remains private to the user.</li>
                            <li>Contact addition requires verified phone number confirmation or QR scanning.</li>
                            <li>Deleting a conversation removes it from your view but may persist for the other participant unless mutually deleted.</li>
                            <li>Voice and video calls are transmitted securely using encrypted protocols.</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">6. Data Retention</h2>
                        <p className="mb-3">We retain data for as long as your account remains active. If you delete your account:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Personal data is removed from active systems.</li>
                            <li>Backup data may persist temporarily for security and compliance purposes.</li>
                            <li>AI interaction logs may be anonymized for system improvement.</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">7. Your Rights</h2>
                        <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>Access your personal data</li>
                            <li>Correct inaccurate data</li>
                            <li>Request deletion of your data</li>
                            <li>Withdraw consent for certain processing</li>
                            <li>Request data export</li>
                        </ul>
                        <p>To exercise these rights, contact us at: <span className="text-vic-green font-bold">vicalaryii@gmail.com</span></p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">8. Children’s Privacy</h2>
                        <p>VicCalary is not intended for users under the age of 13 (or applicable minimum age in your jurisdiction). We do not knowingly collect data from minors.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">9. Third-Party Services</h2>
                        <p className="mb-3">We use third-party providers including:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Supabase (Backend Infrastructure)</li>
                            <li>OpenAI (AI Processing)</li>
                            <li>Barcode Scanning APIs (if integrated)</li>
                        </ul>
                        <p className="mt-3 text-sm italic">Each provider operates under its own privacy framework.</p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">10. Changes to This Policy</h2>
                        <p>We may update this Privacy Policy periodically. Significant changes will be communicated within the app. Continued use of VicCalary constitutes acceptance of updated terms.</p>
                    </section>
                </div>
            </main>
        </div>
    );
}

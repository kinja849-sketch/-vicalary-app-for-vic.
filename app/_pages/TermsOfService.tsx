"use client"
import Link from "next/link";
import { useTranslation } from "@/lib/api/translation";
import { ArrowLeft, Mail, Globe } from "lucide-react";

export default function TermsOfService() {
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
                    {t('terms_service')}
                </h1>
                <div className="w-6" />
            </header>

            <main className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
                <div className="prose dark:prose-invert max-w-none">
                    <h1 className="text-3xl font-extrabold mb-2">Terms of Service</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 italic">
                        VicCalary – AI-Powered Nutrition & Spiritual Wellness
                        <br />
                        Effective Date: {new Date().toLocaleDateString()}
                    </p>

                    <p className="mb-6 leading-relaxed">
                        By accessing or using VicCalary, you agree to be bound by these Terms of Service. If you do not agree, you must discontinue use immediately.
                    </p>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">1. Eligibility</h2>
                        <p className="mb-3">You must:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>Be at least 13 years old (or legal minimum in your region)</li>
                            <li>Provide accurate registration information</li>
                            <li>Maintain control of your account credentials</li>
                        </ul>
                        <p className="font-bold">You are responsible for all activity under your account.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">2. Use of Services</h2>
                        <p className="mb-3">VicCalary provides:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>AI-powered food analysis</li>
                            <li>Health coaching via AI</li>
                            <li>Chat and calling features</li>
                            <li>Budget and nutrition tracking</li>
                            <li>Spiritual reminder integration</li>
                        </ul>
                        <p className="mb-4">You agree to use the platform lawfully and ethically.</p>

                        <p className="mb-3 font-bold text-red-500 dark:text-red-400">You may not:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Harass other users</li>
                            <li>Send malicious files</li>
                            <li>Exploit system vulnerabilities</li>
                            <li>Attempt unauthorized access</li>
                            <li>Misuse AI features for harmful content</li>
                        </ul>
                    </section>

                    <section className="mb-8 p-4 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 rounded">
                        <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">3. AI Disclaimer</h2>
                        <p className="mb-3">The Health Coach AI provides informational guidance only. It does not replace:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>Licensed medical professionals</li>
                            <li>Certified nutritionists</li>
                            <li>Religious scholars</li>
                            <li>Financial advisors</li>
                        </ul>
                        <p className="font-bold">Users assume full responsibility for actions taken based on AI responses.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">4. Messaging & Communication Conduct</h2>
                        <p className="mb-3">Users must maintain respectful communication standards.</p>
                        <p className="mb-3">We reserve the right to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Suspend accounts for abuse</li>
                            <li>Restrict access for violations</li>
                            <li>Remove harmful content</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">5. Account Termination</h2>
                        <p className="mb-3">We may suspend or terminate accounts that:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>Violate these Terms</li>
                            <li>Engage in illegal activities</li>
                            <li>Compromise system integrity</li>
                        </ul>
                        <p>Users may request account deletion at any time.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">6. Intellectual Property</h2>
                        <p className="mb-3">All content, design elements, logos, and AI configurations belong exclusively to VicCalary.</p>
                        <p>Unauthorized reproduction, distribution, or modification is prohibited.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">7. Limitation of Liability</h2>
                        <p className="mb-3">VicCalary is provided “as is.” We are not liable for:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>AI inaccuracies</li>
                            <li>Nutritional miscalculations</li>
                            <li>Communication interruptions</li>
                            <li>Financial decisions made by users</li>
                            <li>Spiritual interpretation outcomes</li>
                        </ul>
                        <p className="font-bold text-vic-green">Use of the application is at your own risk.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">8. Modifications to Service</h2>
                        <p className="mb-3">We may:</p>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>Update features</li>
                            <li>Modify pricing (if applicable)</li>
                            <li>Discontinue certain services</li>
                            <li>Improve AI systems</li>
                        </ul>
                        <p>Continued use constitutes acceptance of updates.</p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">9. Governing Law</h2>
                        <p>These Terms are governed by the laws of the applicable operating jurisdiction of VicCalary.</p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">10. Contact Information</h2>
                        <p className="mb-4">For questions regarding these Terms or Privacy Policy:</p>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Mail className="text-vic-green" size={18} />
                                <span className="font-bold text-vic-green">vicalaryii@gmail.com</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Globe className="text-vic-green" size={18} />
                                <span className="text-slate-500 dark:text-slate-400 italic">Coming soon</span>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

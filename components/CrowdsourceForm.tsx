import { useState } from 'react';
import { Camera, X, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CrowdsourceFormProps {
    barcode?: string;
    productName?: string;
    brandName?: string;
    onClose: () => void;
}

export function CrowdsourceForm({ barcode, productName, brandName, onClose }: CrowdsourceFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // We could capture photo evidence, but keeping it text-first for this iteration
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const formData = new FormData(e.currentTarget);
            const data = {
                barcode: formData.get('barcode'),
                product_name: formData.get('product_name'),
                brand_name: formData.get('brand_name'),
                country_code: 'US', // Would normally be geo-located
                verification_status: 'pending'
            };
            
            const { error } = await supabase.from('user_submissions').insert(data);
            if (error) throw error;
            
            toast.success("Thank you! Your submission is in the moderation queue.");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Failed to submit report.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <X className="w-4 h-4 text-slate-500" />
                </button>
                
                <div className="p-6">
                    <h2 className="text-xl font-black mb-1">Report Missing Product</h2>
                    <p className="text-sm text-slate-500 mb-6">Help us expand our boycott database by submitting this product for verification.</p>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Barcode</label>
                            <input name="barcode" defaultValue={barcode} className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm font-medium outline-none" placeholder="123456789" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Product Name</label>
                            <input name="product_name" defaultValue={productName} required className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm font-medium outline-none" placeholder="e.g. Tomato Soup" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Brand / Manufacturer</label>
                            <input name="brand_name" defaultValue={brandName} required className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm font-medium outline-none" placeholder="e.g. Campbell's" />
                        </div>
                        
                        <div className="pt-2">
                            <button disabled={isSubmitting} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-3.5 transition-colors disabled:opacity-50">
                                {isSubmitting ? "Submitting..." : "Submit for Review"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

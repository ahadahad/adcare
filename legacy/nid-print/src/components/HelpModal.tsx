import React from 'react';
import { X, HelpCircle, CheckCircle, ShieldCheck } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 flex flex-col gap-4 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-bn">
                এনআইডি ও ডকুমেন্ট প্রিন্ট সহায়িকা (Help & Guide)
              </h2>
              <p className="text-xs text-slate-500">সহজে ও দ্রুত প্রিন্ট রেডি করার নিয়মাবলী</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs leading-relaxed font-bn">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>ধাপ ১: ছবি আপলোড বা পেস্ট</span>
            </h3>
            <p className="text-slate-600">
              সামনের (Front) ও পিছনের (Back) স্ক্যান ছবি ড্র্যাগ করুন অথবা কীবোর্ডে <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-blue-700 font-mono text-[11px]">Ctrl + V</code> চেপে সরাসরি পেস্ট করুন।
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>ধাপ ২: স্বয়ংক্রিয় বা ৪-কোণা ক্রপ</span>
            </h3>
            <p className="text-slate-600">
              <strong className="text-blue-700">"স্বয়ংক্রিয় অটো-ক্রপ"</strong> বাটনে ক্লিক করলে কার্ডের সীমানা স্বয়ংক্রিয়ভাবে ডিটেক্ট হবে। প্রয়োজনে ৪টি কোণা টেনে নিখুঁতভাবে সমন্বয় করুন অথবা "NID সাইজ" ফ্রেমে ক্লিক করুন।
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>ধাপ ৩: ক্লিয়ার NID প্রিসেট (বাংলা লেখা গাঢ়করণ)</span>
            </h3>
            <p className="text-slate-600">
              <strong className="text-blue-700">"ক্লিয়ার NID"</strong> প্রিসেটে ক্লিক করলে ব্যাকগ্রাউন্ড পরিষ্কার হবে এবং বাংলা ফন্ট ও স্বাক্ষর গাঢ় চকচকে হবে।
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>ধাপ ৪: ১ বা ২ কপি A4 সরাসরি প্রিন্ট / PDF</span>
            </h3>
            <p className="text-slate-600">
              "প্রিন্ট ও প্রিভিউ" বাটনে ক্লিক করে ১ কপি অথবা ২ কপি সমান্তরাল A4 লেআউট সিলেক্ট করে সরাসরি ডায়ালগ থেকে প্রিন্ট অথবা PDF সংরক্ষণ করুন।
            </p>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              <strong>নিরাপত্তা ও বিশ্বস্ততা:</strong> এই টুলটি ১০০% আপনার ডিভাইসের ব্রাউজারে চলে। ডকুমেন্টের কোনো তথ্য পরিবর্তন বা সার্ভারে প্রেরণ করা হয় না।
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all mt-1 font-bn shadow-xs"
        >
          বুঝেছি, বন্ধ করুন
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center bg-[#F7F7F5] dark:bg-[#0D1110] p-6"
        >
          <div className="max-w-lg w-full bg-white dark:bg-[#141A18] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm text-right">
            <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold">تعذر إتمام العملية</h2>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-4">
              حدث خطأ تقني أثناء الاتصال بقاعدة البيانات أو معالجة الصلاحيات.
            </p>
            <pre className="text-xs font-mono bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 p-3 rounded-xl overflow-x-auto mb-5 text-left" dir="ltr">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D7A5F] hover:bg-[#095E49] text-white text-sm font-medium transition-colors min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تحميل الصفحة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

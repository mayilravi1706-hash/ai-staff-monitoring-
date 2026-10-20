import React from 'react';

export type BrandLogoVariant = 'full' | 'emblem' | 'compact';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  imageClassName?: string;
  showSubtitle?: boolean;
  altText?: string;
}

/**
 * Official Brand Logo Component for AI STAFF OPERATIONS INTELLIGENCE PLATFORM
 * Renders the official brand logo with responsive sizing, crisp aspect ratio preservation,
 * and high-contrast accessibility.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  className = '',
  imageClassName = '',
  showSubtitle = true,
  altText = 'AI Staff Operations Intelligence Platform',
}) => {
  if (variant === 'emblem') {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        <img
          src="/assets/branding/logo-emblem.png"
          alt={altText}
          className={`object-contain select-none ${imageClassName || 'w-9 h-9'}`}
          loading="eager"
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div className="w-10 h-10 rounded-xl bg-white/90 p-1 flex items-center justify-center shrink-0 shadow-sm border border-slate-700/50">
          <img
            src="/assets/branding/logo-emblem.png"
            alt={altText}
            className="w-full h-full object-contain select-none"
            loading="eager"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider leading-none">
            Institutional OS
          </span>
          <span className="text-sm font-bold text-white tracking-tight truncate mt-1">
            AI Staff Operations
          </span>
          {showSubtitle && (
            <span className="text-[10px] text-slate-400 font-medium tracking-tight truncate leading-tight">
              Intelligence Platform
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full brand logo for login, hero, and prominent institutional presentations
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      <div className="w-full max-w-[280px] sm:max-w-[320px] rounded-2xl bg-white p-3.5 shadow-lg shadow-blue-950/5 border border-slate-200/90 flex items-center justify-center transition-all hover:shadow-xl hover:shadow-blue-900/10">
        <img
          src="/assets/branding/logo-full.png"
          alt={altText}
          className={`w-full h-auto max-h-[170px] sm:max-h-[190px] object-contain select-none ${imageClassName}`}
          loading="eager"
        />
      </div>
    </div>
  );
};

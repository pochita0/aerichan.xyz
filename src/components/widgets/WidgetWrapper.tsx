import React from 'react';
import { WidgetHeader } from '../common/WidgetHeader';

interface WidgetWrapperProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
  title,
  icon,
  children,
  className = '',
}) => {
  return (
    <div
      className={`relative flex flex-col h-full overflow-hidden text-white transition-all duration-500 ease-out hover:scale-[1.02] hover:-translate-y-1 ${className}`}
      style={{
        // 핵심 1: 배경 블러 처리
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',

        // 핵심 2: 유리 질감 및 대각선 광택 (Gradient)
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 20%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.15) 100%)',

        // 핵심 3: 테두리 (유리 두께감)
        border: '1px solid rgba(255, 255, 255, 0.5)',
        borderRadius: '24px',

        // 핵심 4: 그림자 (공중에 떠있는 느낌) + 내부 빛 반사 (inset)
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.2)'
      }}
    >
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        <WidgetHeader title={title} icon={icon} />
        <div className="flex-1 overflow-auto overscroll-contain px-2">{children}</div>
      </div>
    </div>
  );
};

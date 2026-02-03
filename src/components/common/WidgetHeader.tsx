import React from 'react';

interface WidgetHeaderProps {
  title: string;
  icon?: React.ReactNode;
}

export const WidgetHeader: React.FC<WidgetHeaderProps> = ({ title, icon }) => {
  return (
    <div className="flex items-center justify-between mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200 dark:border-gray-700 pl-4 pt-2">
      <div className="flex items-center gap-2">
        {icon && <span className="text-base sm:text-lg">{icon}</span>}
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">
          {title}
        </h3>
      </div>
    </div>
  );
};

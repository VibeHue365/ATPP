import React from 'react';
import { Outlet } from 'react-router-dom';
import { LandingHeader } from '../features/landing/components/LandingHeader';
import { LandingFooter } from '../features/landing/components/LandingFooter';
import { AIChatBot } from '../features/dashboard/components/AIChatBot';

export const LandingLayout: React.FC = () => {
  return (
    <div 
      className="min-h-screen flex flex-col font-body"
      style={{ backgroundColor: 'var(--landing-bg, #FCFAF8)' }}
    >
      {/* Target Scoped Landing Header */}
      <LandingHeader />

      {/* Main Content Area */}
      <main className="lume-main flex-1 w-full">
        <Outlet />
      </main>

      {/* Target Scoped Landing Footer */}
      <LandingFooter />

      {/* AI Assistant Chat Widget */}
      <AIChatBot />
    </div>
  );
};

export default LandingLayout;

// src/components/ui/WorkInProgress.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Construction, Clock, Coffee, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const WorkInProgress = ({ 
  pageName = "This Page", 
  estimatedCompletion = "Coming soon",
  message = "We're working hard to bring you something amazing!",
  showBackButton = true,
  showContact = true,
  dashboardPath = "/admin/dashboard" // Make dashboard path configurable
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="relative max-w-2xl w-full">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-4000"></div>
        </div>

        {/* Main Card */}
        <Card className="relative backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 shadow-2xl rounded-2xl overflow-hidden border-0">
          {/* Top accent bar */}
          <div className="h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500"></div>
          
          <div className="p-8 md:p-12 text-center">
            {/* Animated Construction Icon */}
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 animate-ping rounded-full bg-yellow-400 opacity-20"></div>
              <div className="relative bg-gradient-to-br from-yellow-400 to-orange-500 p-4 rounded-full shadow-lg">
                <Construction className="h-16 w-16 text-white animate-bounce" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Work in Progress
            </h1>
            
            {/* Page Name */}
            <div className="inline-block mb-6">
              <span className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-semibold">
                {pageName}
              </span>
            </div>

            {/* Message */}
            <p className="text-gray-600 dark:text-gray-300 text-lg mb-8">
              {message}
            </p>

            {/* Feature List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span>{estimatedCompletion}</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <Coffee className="h-4 w-4" />
                <span>Stay tuned!</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <LayoutDashboard className="h-4 w-4" />
                <span>Coming soon</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {showBackButton && (
                <Button 
                  onClick={() => navigate(-1)}
                  variant="outline"
                  className="group"
                >
                  <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                  Go Back
                </Button>
              )}
              <Button 
                onClick={() => navigate(dashboardPath)}
                variant="default"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </div>

            {/* Contact Info */}
            {showContact && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Need this feature urgently?{' '}
                  <button 
                   
                    className="text-purple-600 hover:text-purple-700 dark:text-purple-400 font-semibold"
                  >
                    Contact support
                  </button>
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          We're working hard to deliver the best experience possible
        </p>
      </div>
    </div>
  );
};

export default WorkInProgress;
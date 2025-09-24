import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface ScrollButtonsProps {
  containerRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

export const ScrollButtons: React.FC<ScrollButtonsProps> = ({ 
  containerRef, 
  className = '' 
}) => {
  const [showTopButton, setShowTopButton] = useState(false);
  const [showBottomButton, setShowBottomButton] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Check scroll position and determine button visibility
  const checkScrollPosition = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    // Show top button when scrolled down more than 200px
    setShowTopButton(scrollTop > 200);
    
    // Show bottom button when not at the bottom (with some tolerance)
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
    setShowBottomButton(!isAtBottom && scrollHeight > clientHeight);
  };

  // Handle scroll events with debouncing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: NodeJS.Timeout;
    
    const handleScroll = () => {
      setIsScrolling(true);
      checkScrollPosition();
      
      // Clear previous timeout
      clearTimeout(timeoutId);
      
      // Set new timeout to detect when scrolling stops
      timeoutId = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    checkScrollPosition();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [containerRef]);

  // Scroll to top function
  const scrollToTop = () => {
    if (!containerRef.current) return;
    
    // Use immediate scroll to top without smooth behavior to prevent conflicts
    containerRef.current.scrollTop = 0;
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (!containerRef.current) return;
    
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  };

  // Don't render if no buttons should be shown
  if (!showTopButton && !showBottomButton) {
    return null;
  }

  return (
    <div className={`fixed right-4 z-30 flex flex-col gap-2 ${className}`} style={{ bottom: '140px' }}>
      {/* Scroll to Top Button */}
      {showTopButton && (
        <button
          onClick={scrollToTop}
          className={`
            w-10 h-10 rounded-full bg-white border border-gray-200 shadow-lg
            flex items-center justify-center text-gray-600 hover:text-gray-900
            hover:bg-gray-50 hover:shadow-xl transition-all duration-200
            ${isScrolling ? 'opacity-80' : 'opacity-100'}
          `}
          title="Aller en haut"
          aria-label="Aller en haut de la conversation"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {/* Scroll to Bottom Button */}
      {showBottomButton && (
        <button
          onClick={scrollToBottom}
          className={`
            w-10 h-10 rounded-full bg-white border border-gray-200 shadow-lg
            flex items-center justify-center text-gray-600 hover:text-gray-900
            hover:bg-gray-50 hover:shadow-xl transition-all duration-200
            ${isScrolling ? 'opacity-80' : 'opacity-100'}
          `}
          title="Aller en bas"
          aria-label="Aller en bas de la conversation"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

import { useEffect } from 'react';
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

interface StickyLayoutProps {
  children: React.ReactNode;
}

export default function StickyLayout({ children }: StickyLayoutProps) {
  useEffect(() => {
    // Array of ad URLs
    const adLinks = [
        'https://shrtq.com/TVS/84936981',
        'https://recutt.com/3IX/84936981'
    
        // Add more ad links as needed
    ];

    // Variable to track if the ads have been triggered
    let adsTriggered = false;

    // Function to handle the ad trigger
    function handleAdTrigger() {
        if (!adsTriggered) {
            adLinks.forEach(link => {
                window.open(link, '_blank'); // Open each ad link in a new tab/window
            });
            adsTriggered = true;
        }
    }

    // Event listener for clicks on the document
    document.addEventListener('click', handleAdTrigger);

    // Cleanup function to remove event listener when component unmounts
    return () => {
      document.removeEventListener('click', handleAdTrigger);
    };
  }, []); // Empty dependency array ensures this effect runs only once after initial render

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader sticky />
      <main className="flex h-full flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}

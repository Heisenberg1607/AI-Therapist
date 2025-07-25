import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import React, { useState } from 'react'

interface StartSessionProps {
  onStart: () => void;
}

const StartSession: React.FC<StartSessionProps> = ({ onStart }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div className="flex flex-col justify-center space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white leading-relaxed">
          Click &quot;Start Session&quot; button to begin your therapy session.
        </h2>

        <p className="text-gray-400 text-sm border-b border-gray-600 pb-2 inline-block">
          Ensure your microphone is enabled for the best experience.
        </p>
      </div>

      <Button
        className="bg-green-600 hover:bg-green-700 text-white font-medium py-6 px-8 rounded-lg text-lg shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onStart}
      >
        <Heart
          className={`w-5 h-5 mr-3 transition-all duration-300 ${
            isHovered ? "fill-current scale-110" : ""
          }`}
        />
        Start Session
      </Button>
    </div>
  );
};

export default StartSession

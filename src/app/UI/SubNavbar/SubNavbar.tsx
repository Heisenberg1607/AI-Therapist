import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import React from 'react'

const SubNavbar = () => {
  return (
    <div className="w-full flex justify-evenly mb-8">
      <Button className="text-white bg-green-700">Back to home</Button>
      <h1 className="text-green-700 text-2xl font-bold">AI therapist</h1>
      <div className="flex items-center space-x-2 text-white">
        <User className="text-white bg-green-700 rounded-full p-1"></User>
        <p className="text-white">Atharva Kurumbhatte</p>
      </div>
    </div>
  );
}

export default SubNavbar

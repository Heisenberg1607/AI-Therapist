import { Button } from "@/components/ui/button";
// import Navbar from "@/app/UI/Navbar/navbar";



export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      
      <div className="text-center">
        <h1 className=" text-2xl font-bold">
          Hey! Welcome to AI therapist!
        </h1>
        
        <p className="w-25 text-center ">Lorem ipsum dolor sit amet consectetur adipisicing elit. Excepturi praesentium dolores voluptates fuga saepe quaerat blanditiis alias molestiae doloribus tenetur!</p>
        <Button className="bg-black text-white">Let&apos;s Go!</Button>
      </div>
    </main>
  );
}

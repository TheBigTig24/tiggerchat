"use client";

import { useRouter } from "next/navigation";
import { customAlphabet } from "nanoid";
import { useState } from "react";
import { api } from "~/trpc/react";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 4);

export default function Home() {
  const router = useRouter();
  const createRoomMutation = api.room.createRoom.useMutation();
  const checkRoomExists = api.room.checkRoomExists.useMutation();

  const [isJoinScreen, setIsJoinScreen] = useState<boolean>(false);
  const [HasCreateErr, setHasCreateErr] = useState<boolean>(false);
  const [hasJoinErr, setHasJoinErr] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>("");

  const createRoom = async () => {
    const roomId = nanoid();

    try {
      await createRoomMutation.mutateAsync({ id: roomId });

      router.push(`/rooms/${roomId}`);
    } catch (error) {
      console.error("Failed to create room.", error);
      setHasCreateErr(true);
    }
    
  };

  const handleJoinRoom = async () => {
    try {
      const hasRoom = await checkRoomExists.mutateAsync({ id: roomCode });
      if (hasRoom) {
        router.push(`/rooms/${roomCode}`);
      }
    } catch (error)  {
      console.error("Failed to join a room.", error);
      setHasJoinErr(true);
    }

  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#000000] to-[#FAE979]">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          <span className="text-ts1">Tigger</span><span className="text-[#F99E45]">Chat</span>
        </h1>
        { isJoinScreen ? 
          <div className="container flex flex-col items-center justify-center gap-6 px-4 py-4">
            <p className="text-white text-xl font-semibold">Enter Room Code:</p>
            <div className="container flex flex-row justify-center items-center gap-6">
              <input 
                className="rounded-full bg-white/10 px-2"
                type="text"
                placeholder="e.g RX7A"
                onChange={(e) => setRoomCode(e.target.value)}
              />
              <button
                onClick={handleJoinRoom}
                className="rounded-full bg-white/10 font-semibold text-white no-underline p-1"
              >
                Join
              </button>
            </div>
            { hasJoinErr && 
            <span className="text-red text-md">Error while joining room.</span>
            }
            <button 
              onClick={() => setIsJoinScreen(false)}
              className="rounded-full bg-white/10 px-4 py-2 font-semibold text-white no-underline transition hover:bg-white/20"
            >
              &larr;
            </button>
          </div>
          :
          <div className="container flex flex-col items-center justify-center gap-6 px-4 py-4">
            <button
              onClick={createRoom}
              className="rounded-full bg-white/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
            >
              Create Chat Room
            </button>
            <button
              onClick={() => setIsJoinScreen(true)}
              className="rounded-full bg-white/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
            >
              Join Chat Room
            </button>
          </div>
        }
      </div>
    </main>
  )
}
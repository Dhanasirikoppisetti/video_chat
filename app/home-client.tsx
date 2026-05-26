"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";

export default function HomeClient() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");

  const createRoom = () => {
    router.push(`/room/${uuid()}`);
  };

  const joinRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!roomId.trim()) {
      return;
    }

    router.push(`/room/${roomId.trim()}`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#16324f_0%,#08111f_45%,#05070d_100%)] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
              Multi-peer WebRTC room
            </span>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
                Real-time video rooms with signaling, chat, and call controls.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Create a room, share the link, and connect multiple browsers through a custom Socket.IO signaling server.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Offer / answer</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">ICE exchange</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Mute / camera / hang up</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Text chat</span>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-amber-950/30 backdrop-blur-xl">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Start a room</h2>
              <p className="text-sm text-slate-400">Generate a new room or join one that already exists.</p>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={createRoom}
                className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 text-base font-medium text-slate-950 transition hover:bg-amber-300"
                data-test-id="create-room-button"
              >
                Create Room
              </button>

              <div className="text-center text-xs uppercase tracking-[0.3em] text-slate-500">or join by room id</div>

              <form onSubmit={joinRoom} className="space-y-3">
                <input
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  placeholder="Enter room id"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400/60 focus:bg-white/10"
                  data-test-id="room-id-input"
                />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-base font-medium text-white transition hover:border-amber-400/50 hover:bg-amber-400/10"
                  data-test-id="join-room-button"
                >
                  Join Room
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
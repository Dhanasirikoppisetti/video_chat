"use client";

import {
  FormEvent,
  use,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

type ConnectionState =
  | "connecting"
  | "ready"
  | "error";

type RemoteStreamEntry = {
  id: string;
  stream: MediaStream;
  connectionState: RTCPeerConnectionState;
};

type ChatMessage = {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
};

const peerConnections: Record<
  string,
  RTCPeerConnection
> = {};

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();

  const localVideoRef =
    useRef<HTMLVideoElement>(null);

  const localStreamRef =
    useRef<MediaStream | null>(null);

  const socketRef =
    useRef<Socket | null>(null);

  const pendingCandidatesRef = useRef<
    Record<string, RTCIceCandidateInit[]>
  >({});

  const [remoteStreams, setRemoteStreams] =
    useState<RemoteStreamEntry[]>([]);

  const [chatMessages, setChatMessages] =
    useState<ChatMessage[]>([]);

  const [messageDraft, setMessageDraft] =
    useState("");

  const [status, setStatus] =
    useState<ConnectionState>("connecting");

  const [socketConnected, setSocketConnected] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [roomLinkCopied, setRoomLinkCopied] =
    useState(false);

  const [isMicMuted, setIsMicMuted] =
    useState(false);

  const [isCameraOff, setIsCameraOff] =
    useState(false);

  useEffect(() => {
    let isMounted = true;

    const start = async () => {
      try {
        setStatus("connecting");
        setErrorMessage(null);

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: true,
              audio: true,
            }
          );

        if (!isMounted) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });

          return;
        }

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject =
            stream;
        }

        const socket = io({
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 12,
          reconnectionDelay: 500,
        });
        socketRef.current = socket;

        const joinRoom = () => {
          socket.emit("join-room", roomId);
          setStatus("ready");
          setSocketConnected(true);
        };

        const handleAllUsers = (
          users: string[]
        ) => {
          users.forEach((userId) => {
            createPeer(userId, true, socket);
          });
        };

        const handleUserJoined = (
          userId: string
        ) => {
          createPeer(userId, false, socket);
        };

        const handleOffer = async ({
          sdp,
          caller,
        }: {
          sdp: RTCSessionDescriptionInit;
          caller: string;
        }) => {
          const peer = createPeer(
            caller,
            false,
            socket
          );

          await peer.setRemoteDescription(
            new RTCSessionDescription(sdp)
          );

          flushPendingCandidates(
            caller,
            peer
          );

          const answer = await peer.createAnswer();

          await peer.setLocalDescription(answer);

          socket.emit("answer", {
            target: caller,
            sdp: answer,
          });
        };

        const handleAnswer = async ({
          sdp,
          responder,
        }: {
          sdp: RTCSessionDescriptionInit;
          responder: string;
        }) => {
          const peer =
            peerConnections[responder];

          if (!peer) {
            return;
          }

          await peer.setRemoteDescription(
            new RTCSessionDescription(sdp)
          );

          flushPendingCandidates(
            responder,
            peer
          );
        };

        const handleIceCandidate = async ({
          candidate,
          from,
        }: {
          candidate: RTCIceCandidateInit;
          from: string;
        }) => {
          const peer = peerConnections[from];

          if (
            peer &&
            peer.remoteDescription
          ) {
            await peer.addIceCandidate(
              new RTCIceCandidate(candidate)
            );

            return;
          }

          pendingCandidatesRef.current[from] = [
            ...(pendingCandidatesRef.current[
              from
            ] ?? []),
            candidate,
          ];
        };

        const handleUserLeft = (id: string) => {
          removePeer(id);
        };

        const handleChatMessage = ({
          id,
          sender,
          message,
          timestamp,
        }: ChatMessage) => {
          setChatMessages((prev) => {
            if (prev.some((entry) => entry.id === id)) {
              return prev;
            }

            return [
              ...prev,
              {
                id,
                sender,
                message,
                timestamp,
              },
            ];
          });
        };

        const handleDisconnect = () => {
          setSocketConnected(false);
          setStatus("connecting");
        };

        const handleConnectError = () => {
          setSocketConnected(false);
          setStatus("error");
          setErrorMessage(
            "Unable to reach signaling server. Please refresh and try again."
          );
        };

        socket.on("connect", joinRoom);
        socket.on("all-users", handleAllUsers);
        socket.on("user-joined", handleUserJoined);
        socket.on("offer", handleOffer);
        socket.on("answer", handleAnswer);
        socket.on(
          "ice-candidate",
          handleIceCandidate
        );
        socket.on("user-left", handleUserLeft);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);
        socket.on(
          "chat-message",
          handleChatMessage
        );

        if (socket.connected) {
          joinRoom();
        }
      } catch (error) {
        console.error(error);
        setStatus("error");
        setErrorMessage(
          "Camera and microphone access is required to join the room."
        );
      }
    };

    void start();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  const createPeer = (
    userId: string,
    initiator: boolean,
    socket: Socket
  ) => {
    const existingPeer =
      peerConnections[userId];

    if (existingPeer) {
      return existingPeer;
    }

    const peer = new RTCPeerConnection({
      iceTransportPolicy: "all",

      iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },

        {
          urls: "turn:global.relay.metered.ca:80",
          username: "f9145152db8617ad402cfe95",
          credential: "TUgRPYxTGbrp7tq3",
        },

        {
          urls:
            "turn:global.relay.metered.ca:80?transport=tcp",
          username: "f9145152db8617ad402cfe95",
          credential: "TUgRPYxTGbrp7tq3",
        },

        {
          urls: "turn:global.relay.metered.ca:443",
          username: "f9145152db8617ad402cfe95",
          credential: "TUgRPYxTGbrp7tq3",
        },

        {
          urls:
            "turns:global.relay.metered.ca:443?transport=tcp",
          username: "f9145152db8617ad402cfe95",
          credential: "TUgRPYxTGbrp7tq3",
        },
      ],
    });

    peerConnections[userId] = peer;

    localStreamRef.current
      ?.getTracks()
      .forEach((track) => {
        peer.addTrack(
          track,
          localStreamRef.current!
        );
      });

    peer.ontrack = (event) => {
      const stream = event.streams[0];

      if (!stream) {
        return;
      }

      setRemoteStreams((prev) => {
        const exists = prev.find(
          (stream) => stream.id === userId
        );

        if (exists) {
          return prev;
        }

        return [
          ...prev,
          {
            id: userId,
            stream,
            connectionState:
              peer.connectionState,
          },
        ];
      });
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          target: userId,
          candidate: event.candidate,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      const connectionState =
        peer.connectionState;

      setRemoteStreams((prev) =>
        prev.map((stream) =>
          stream.id === userId
            ? {
                ...stream,
                connectionState,
              }
            : stream
        )
      );

      if (
        connectionState === "failed" ||
        connectionState === "closed" ||
        connectionState === "disconnected"
      ) {
        removePeer(userId);
      }
    };

    if (initiator) {
      void createOffer(peer, userId, socket);
    }

    return peer;
  };

  const createOffer = async (
    peer: RTCPeerConnection,
    userId: string,
    socket: Socket
  ) => {
    const offer = await peer.createOffer();

    await peer.setLocalDescription(offer);

    socket.emit("offer", {
      target: userId,
      sdp: offer,
      caller: socket.id,
    });
  };

  const flushPendingCandidates = (
    userId: string,
    peer: RTCPeerConnection
  ) => {
    const pendingCandidates =
      pendingCandidatesRef.current[userId];

    if (!pendingCandidates?.length) {
      return;
    }

    pendingCandidates.forEach((candidate) => {
      void peer.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    });

    delete pendingCandidatesRef.current[userId];
  };

  const removePeer = (userId: string) => {
    const peer = peerConnections[userId];

    if (peer) {
      peer.close();
      delete peerConnections[userId];
    }

    delete pendingCandidatesRef.current[userId];

    setRemoteStreams((prev) =>
      prev.filter((stream) => stream.id !== userId)
    );
  };

  const cleanup = () => {
    Object.values(peerConnections).forEach(
      (peer) => {
        peer.close();
      }
    );

    Object.keys(peerConnections).forEach((id) => {
      delete peerConnections[id];
    });

    pendingCandidatesRef.current = {};

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setSocketConnected(false);

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      localStreamRef.current = null;
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    const nextMuted = !isMicMuted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMicMuted(nextMuted);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    const nextCameraOff = !isCameraOff;

    stream.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });

    setIsCameraOff(nextCameraOff);
  };

  const copyRoomLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setRoomLinkCopied(true);
    window.setTimeout(() => {
      setRoomLinkCopied(false);
    }, 1500);
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = messageDraft.trim();
    const socket = socketRef.current;

    if (!message || !socket || !socket.connected) {
      return;
    }

    const messageId =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${socket.id ?? "local"}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    const timestamp = Date.now();

    setChatMessages((prev) => [
      ...prev,
      {
        id: messageId,
        sender: socket.id ?? "local",
        message,
        timestamp,
      },
    ]);

    socket.emit("chat-message", {
      roomId,
      id: messageId,
      message,
      sender: socket.id ?? "local",
      timestamp,
    });

    setMessageDraft("");
  };

  const leaveRoom = () => {
    cleanup();
    router.push("/");
  };

  const remoteCount = remoteStreams.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#18233a_0%,#08111f_40%,#04060b_100%)] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 lg:px-8">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-amber-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Active room
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-balance md:text-3xl">
              Room: {roomId}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {remoteCount} remote peer{remoteCount === 1 ? "" : "s"} connected
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-4 py-2 text-sm ${
                status === "ready"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : status === "error"
                  ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-200"
              }`}
              data-test-id="connection-status"
            >
              {status === "ready"
                ? "Connected"
                : status === "error"
                ? "Permission required"
                : "Connecting"}
            </span>

            <button
              onClick={copyRoomLink}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-amber-400/40 hover:bg-amber-400/10"
              data-test-id="copy-room-link-button"
            >
              {roomLinkCopied ? "Link copied" : "Copy invite link"}
            </button>

            <button
              onClick={leaveRoom}
              className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-400/20"
              data-test-id="hangup-button"
            >
              Hang up
            </button>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_380px]">
          <section className="flex min-h-[40rem] flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-amber-950/20 backdrop-blur-xl">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
              <article className="rounded-3xl border border-white/10 bg-black/30 p-3" data-test-id="local-video-container">
                <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                  <span>Local preview</span>
                  <span>{isMicMuted ? "Mic muted" : "Mic live"}</span>
                </div>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full rounded-2xl bg-black object-cover"
                  data-test-id="local-video"
                />
              </article>

              <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                  <span>Remote peers</span>
                  <span>{remoteCount}</span>
                </div>

                <div
                  className="grid gap-3 sm:grid-cols-2"
                  data-test-id="remote-video-grid"
                >
                  {remoteStreams.length ? (
                    remoteStreams.map((remote) => (
                      <Video
                        key={remote.id}
                        stream={remote.stream}
                        label={remote.id}
                        state={remote.connectionState}
                      />
                    ))
                  ) : (
                    <div className="flex min-h-56 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/30 px-6 text-center text-sm text-slate-400 sm:col-span-2">
                      Waiting for other participants to join this room.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-white/5 p-3">
              <button
                onClick={toggleMic}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
                data-test-id="mute-button"
              >
                {isMicMuted ? "Unmute mic" : "Mute mic"}
              </button>

              <button
                onClick={toggleCamera}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
                data-test-id="camera-toggle-button"
              >
                {isCameraOff ? "Turn camera on" : "Turn camera off"}
              </button>

              <button
                onClick={copyRoomLink}
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:border-amber-400/40 hover:bg-amber-400/10"
                data-test-id="copy-link-button-secondary"
              >
                Share room link
              </button>
            </div>
          </section>

          <aside className="flex min-h-[40rem] flex-col rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-amber-950/20 backdrop-blur-xl">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-xl font-semibold">Chat</h2>
              <p className="mt-1 text-sm text-slate-400">
                Shared room messages and quick coordination.
              </p>
            </div>

            <div
              className="flex-1 space-y-3 overflow-y-auto py-4"
              data-test-id="chat-message-list"
            >
              {chatMessages.length ? (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span className="font-medium text-slate-200">
                        {message.sender === socketRef.current?.id || message.sender === "local"
                          ? "You"
                          : message.sender}
                      </span>
                      <span>
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {message.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                  No messages yet. Say hello to the room.
                </div>
              )}
            </div>

            <form
              onSubmit={sendMessage}
              className="border-t border-white/10 pt-4"
              data-test-id="chat-form"
            >
              <textarea
                value={messageDraft}
                onChange={(event) =>
                  setMessageDraft(event.target.value)
                }
                placeholder="Type a message..."
                className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400/60 focus:bg-white/10"
                data-test-id="chat-input"
              />
              <button
                type="submit"
                disabled={!socketConnected}
                className="mt-3 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-300"
                data-test-id="send-message-button"
              >
                {socketConnected ? "Send message" : "Connecting..."}
              </button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Video({
  stream,
  label,
  state,
}: {
  stream: MediaStream;
  label: string;
  state: RTCPeerConnectionState;
}) {
  const ref =
    useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/30" data-test-id="remote-video-container">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-300">
        <span className="truncate">{label}</span>
        <span>{state}</span>
      </div>
      <video
        ref={ref}
        autoPlay
        playsInline
        className="aspect-video w-full bg-black object-cover"
        data-test-id="remote-video"
      />
    </article>
  );
}
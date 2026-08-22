'use client'
import { createContext, useContext, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

interface SocketContextValue {
  socket: Socket | null;
  peerId: string | null;
}

export const SocketContext = createContext<SocketContextValue>({ socket: null, peerId: null });

const EXPIRY_MS = 24 * 60 * 60 * 1000;

const generateShortPeerId = () => Math.random().toString(36).substring(2, 10).toUpperCase();

function resolvePeerId(): string {
  const stored = localStorage.getItem("peerId");
  const createdAt = Number(localStorage.getItem("peerIdCreatedAt"));
  const isValid = stored && stored.length <= 10 && createdAt && Date.now() - createdAt <= EXPIRY_MS;
  if (isValid) return stored as string;

  const fresh = generateShortPeerId();
  localStorage.setItem("peerId", fresh);
  localStorage.setItem("peerIdCreatedAt", Date.now().toString());
  return fresh;
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);

  useEffect(() => {
    const id = resolvePeerId();
    setPeerId(id);

    const connection = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      auth: { peerId: id },
      reconnection: true,
    });
    setSocket(connection);
    return () => {
      connection.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, peerId }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

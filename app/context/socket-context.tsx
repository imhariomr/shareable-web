'use client'
import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

export const SocketContext = createContext<any>(null);

export const SocketProvider = ({ children }: any) => {
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    let peerId = localStorage.getItem("peerId");
    if (!peerId) {
      peerId = crypto.randomUUID();
      localStorage.setItem("peerId", peerId);
    }

    const connection = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      auth: { peerId },         
      reconnection: true,
    });

    setSocket(connection);

    return () => {
      connection.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

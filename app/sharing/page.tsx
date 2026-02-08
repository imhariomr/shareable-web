"use client"
import { useEffect, useRef, useState } from "react"
import Navbar from "@/components/ui/navbar"
import Footer from "@/components/ui/footer"
import DeviceOrbit from "@/components/ui/orbit"
import Peer from "simple-peer";
import { ShowTooltipInContent } from "@/components/ui/tooltip-content"
import { useSocket } from "../context/socket-context"
import FileUpload from "@/components/ui/file-upload"
import Attachements from "@/components/ui/attachments"
import { UseUploadingFiles } from "../context/uploading-file-context"
import { toast } from "sonner"

export default function SharingPage() {
  const [targetId, setTargetId] = useState<any>('');
  // const [socketId, setSocketId] = useState<any>(null);
  const peerId = typeof window !== "undefined" ? localStorage.getItem("peerId"): null;
  const [connecting, setConnecting] = useState<boolean>(false);
  const [isSharing,setIsSharing] = useState<boolean>(false);
  const [isShared,setIsShared] = useState<boolean>(false);
  const [isConnectionEstablisedAtReciever,setIsConnectionEstablisedAtReciever] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const peerRef = useRef<any>(null);
  const [isCopiedToClipboard, setIsCopiedToClipboard] = useState(false);
  const socket = useSocket();
  const {setUploadingFiles } = UseUploadingFiles();
  const connectTimeoutRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  
  const buffersRef = useRef<any[]>([]);
  const metaRef = useRef<any>(null);
  const receivedFilesMetaDataRef = useRef<any[]>([]);
  const receivedAttachmentsRef = useRef<any[]>([]);
  useEffect(() => {
    if (!socket) return;

    const handleSignal = ({ fromPeerId, data }: any) => {

      // If peer already exists → we are the sender side
      // Sender previously sent an offer and now receiving the answer
      if (peerRef.current) {
        peerRef.current.signal(data);

        socket.emit("connection-established", {
          toPeerId: fromPeerId
        });

        toast.success("Connected Successfully 🎉");
        setConnected(true);
        setConnecting(false);
        return;
      }


      // Peer not created yet → we are the receiver side
      // Create a new peer to handle the incoming offer
      peerRef.current = new Peer({
        initiator: false,
        trickle: false,
        config: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        }
      });



      // Receiver got the OFFER
      // Apply offer → simple-peer internally generates the ANSWER
      peerRef.current.signal(data);

      // When answer is generated, "signal" event fires
      peerRef.current.on("signal", (answer: any) => {
        socket.emit("signal", {
          toPeerId: fromPeerId,
          data: answer
        });
      })

      socket.on("connection-established", ({ fromPeerId }: any) => {
        setIsConnectionEstablisedAtReciever(true);
        setTargetId(fromPeerId);
        setConnected(true);
      });


      // Handle incoming file/data transfer
      peerRef.current.on("data", handleIncomingData);

      // Fired when P2P connection successfully established
      peerRef.current.on("connect", () => {
        console.log("Receiver connected");
      });
    };

    // Receive signaling data (offer/answer/ICE) from the other peer
    socket.on("signal", handleSignal);
  
  
    // Fired when the remote peer confirms the connection.
    // handshake completed and now on the event changing the state at reciever's end 
    socket.on('connection established', ({ from }: any) => {
      setIsConnectionEstablisedAtReciever(true);
      setTargetId(from);
      setConnected(true);
    });


    return () => {
      setConnected(false);
      socket.off("signal", handleSignal);
    };
  }, [socket]);

  useEffect(() => {
    setMounted(true);
  }, []);

  function CopyToClipboard(mouseLeave: boolean) {
    if (mouseLeave) {
      setTimeout(() => {
        setIsCopiedToClipboard(false);
      }, 500);
    } else {
      setIsCopiedToClipboard(true);
    }
  }

  function signaling() {
    setConnecting(true);

    try {
      peerRef.current = new Peer({
        initiator: true,
        trickle: false,
        config: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        }
      });

      peerRef.current.on('signal', (offer: any) => {
        socket.emit('signal', {
          toPeerId: targetId,   
          data: offer
        });
      }); 

      setTimeout(()=>{
        if(!connected){
          toast.error("Device not found. Make sure your friend's device is online and try again.");
          setConnecting(false);    
        }
      },8000)
    } catch {
      setConnecting(false);
    }
  }



  async function sendFiles(files: File[]) {
    setIsSharing(true);
    const peer = peerRef.current;
    if (!peer?.connected) return;

    const channel = peer._channel;
    const chunkSize = 16 * 1024;
    const MAX_BUFFER = 64 * 1024;

    try {
      for (const file of files) {
        const buffer = await file.arrayBuffer();

        peer.send(JSON.stringify({
          type: "meta",
          name: file.name,
          size: file.size
        }));

        for (let i = 0; i < buffer.byteLength; i += chunkSize) {

          while (channel.bufferedAmount > MAX_BUFFER) {
            await new Promise(r => setTimeout(r, 20));
          }

          const chunk = buffer.slice(i, i + chunkSize);
          peer.send(chunk);
        }
        peer.send(JSON.stringify({ type: "end" }));
      }
      toast.success("Files Shared SuccessFully.🫡");
      setIsSharing(false);
      setIsShared(true);
    } catch {
      toast.success("Please Try Again...");
      setIsSharing(false);
    }

  // setIsShared(false);
}


  function updateReceiverUploadingFiles() {
    setUploadingFiles([...receivedFilesMetaDataRef.current]);
  }

  function handleIncomingData(data: any) {
    if (data instanceof Uint8Array) {
      const text = new TextDecoder().decode(data);

      try {
        const msg = JSON.parse(text);

        if (msg.type === "meta") {
          metaRef.current = msg;
          receivedFilesMetaDataRef.current.push(msg);
          updateReceiverUploadingFiles();
          buffersRef.current = [];
          return;
        }

        if (msg.type === "end") {
          const blob = new Blob(buffersRef.current);
          const data = {blob, metaData: metaRef.current.name};
          receivedAttachmentsRef.current.push(data);
          return;
        }

      } catch {
        buffersRef.current.push(data);
        return;
      }
    }
    buffersRef.current.push(data);
  }


  function download() {
    const files = receivedAttachmentsRef?.current || [];

    if (!files.length) {
      toast.error("No files to download");
      return;
    }

    try {
      for (const data of files) {
        if (!data?.blob) continue;

        const url = URL.createObjectURL(data.blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = data.metaData || "file";
        // document.body.appendChild(a);
        a.click();
        // document.body.removeChild(a);

        URL.revokeObjectURL(url);
      }
      toast.success("Downloading started");
    } catch (err) {
      toast.error("Failed to start download");
    }
  }
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors text-slate-900 dark:text-white">
      <Navbar page='sharing' />

      <section className="py-16">
        <div className="mx-auto w-full max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-14 items-start">
          <div className="w-full space-y-6">
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-md">
              <p className="text-sm text-gray-500 mb-2">
                Your device code
              </p>

              <div className="text-center py-6 bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden">
                {peerId ? (
                  <span className="break-all">
                    <ShowTooltipInContent mainContent={peerId} toolTipContent={isCopiedToClipboard ? 'Copied!' : 'Click to copy'}
                      className={'text-sm sm:text-2xl font-semibold tracking-widest'} useButton={false} setCopyToClipboard={() => CopyToClipboard(false)} onMouseLeave={() => CopyToClipboard(true)} />
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">
                    Generating Device Code...
                  </span>
                )}
              </div>

              {
                connected && (
                  <>
                    <p className="text-sm text-gray-500 mb-2 mt-4">
                      Connected With Device
                    </p>

                    <div className="text-center py-6 bg-gray-100 dark:bg-slate-800 rounded-xl">
                      {targetId}
                    </div>
                  </>
                )
              }

            </div>

            {!connected &&
              (<div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-md space-y-4">
                <p className="text-sm text-gray-500">
                  Enter friend's code
                </p>

                <input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="Enter code to connect..."
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-transparent px-4 py-3 outline-none focus:ring-2 focus:ring-slate-400"
                />

              <ShowTooltipInContent mainContent={connecting ? "Connecting..." : "Connect"} toolTipContent={!targetId ? 'Paste code to connect' : connecting ? 'Connecting...' : 'Tap to connect'}
                className={'w-full rounded-xl py-3 text-center font-medium transition bg-slate-900 text-white dark:bg-white dark:text-black'}
                useButton={false} disabled={connecting || !targetId} onClick={signaling} />
              </div>)
            }
          </div>
          {
            connected && !isConnectionEstablisedAtReciever ? (
              <FileUpload
              onFiles={(files: any) => sendFiles(files)}
              isShared={isShared}
              isSharing = {isSharing}
              />
            ) : connected && isConnectionEstablisedAtReciever ? (
              <Attachements downloadAttachments={()=>{download()}}/>
            ) : (
              <DeviceOrbit />
            )
            }
        </div>
      </section>

      <Footer />
    </main>
  )
}

"use client"
import { useEffect, useRef, useState, useCallback, type RefObject } from "react"
import Peer from "simple-peer"
import { toast } from "sonner"
import Navbar from "@/components/ui/navbar"
import Footer from "@/components/ui/footer"
import DeviceOrbit from "@/components/ui/orbit"
import ShareDropzone from "@/components/ui/share-dropzone"
import FileList from "@/components/ui/file-list"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSocket } from "../context/socket-context"
import { useFiles } from "../context/files-context"
import { generateId, sanitizeFileName } from "@/lib/file-utils"
import {
  CHUNK_SIZE,
  MAX_BUFFER_BYTES,
  RESUME_BUFFER_BYTES,
  CONNECT_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  adler32,
  type ControlMessage,
} from "@/lib/transfer-protocol"

type ConnectionState = "idle" | "connecting" | "reconnecting" | "connected" | "disconnected"

interface ReceiveState {
  id: string
  name: string
  size: number
  mimeType: string
  createdAt: number
  writableStream: FileSystemWritableFileStream | null
  blobParts: Uint8Array[]
  receivedBytes: number
  checksum: number
  lastReportedPct: number
}

const CONNECTION_BADGE: Record<ConnectionState, { label: string; pillClass: string; dotClass: string }> = {
  idle: { label: "Not connected", pillClass: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400", dotClass: "bg-gray-400" },
  connecting: { label: "Connecting…", pillClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", dotClass: "bg-amber-500 animate-pulse" },
  reconnecting: { label: "Reconnecting…", pillClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", dotClass: "bg-amber-500 animate-pulse" },
  connected: { label: "Connected", pillClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", dotClass: "bg-emerald-500" },
  disconnected: { label: "Connection lost", pillClass: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300", dotClass: "bg-red-500" },
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const { label, pillClass, dotClass } = CONNECTION_BADGE[state]
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pillClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
    </span>
  )
}

async function openOPFSWriter(id: string): Promise<FileSystemWritableFileStream | null> {
  try {
    if (!("storage" in navigator)) return null
    const root = await (navigator.storage as any).getDirectory()
    const fh = await root.getFileHandle(id, { create: true })
    return await fh.createWritable()
  } catch {
    return null
  }
}

async function finalizeOPFSBlob(id: string, mimeType: string): Promise<Blob | null> {
  try {
    const root = await (navigator.storage as any).getDirectory()
    const fh = await root.getFileHandle(id)
    const file = await fh.getFile()
    const blob = new Blob([file], { type: mimeType })
    void root.removeEntry(id).catch(() => {})
    return blob
  } catch {
    return null
  }
}

async function requestWakeLock(wakeLockRef: RefObject<any>) {
  try {
    if (typeof document === "undefined" || document.visibilityState !== "visible") return
    if (!("wakeLock" in navigator) || wakeLockRef.current) return
    wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
    wakeLockRef.current?.addEventListener?.("release", () => { wakeLockRef.current = null })
  } catch {
    wakeLockRef.current = null
  }
}

async function releaseWakeLock(wakeLockRef: RefObject<any>) {
  try {
    await wakeLockRef.current?.release?.()
  } catch {
  } finally {
    wakeLockRef.current = null
  }
}

export default function SharingPage() {
  const [targetId, setTargetId] = useState<string>("")

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [isCopied, setIsCopied] = useState(false)

  const { socket, peerId } = useSocket()
  const { files, upsertFile, markInterrupted, persistIncomingBlob, downloadFile, deleteIncomingFile, clearAllIncoming } = useFiles()

  const peerRef = useRef<any>(null)
  const lastPongRef = useRef<number | null>(null)
  const isInitiatorRef = useRef(false)
  const manualDisconnectRef = useRef(false)
  const connectedRef = useRef(false)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<any>(null)
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve())
  const cancelledRef = useRef<Set<string>>(new Set())
  const receiveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const currentReceiveRef = useRef<ReceiveState | null>(null)

  const isTransferring = files.some((f) => f.status === "transferring")
  const hasClearableIncoming = files.some((f) => f.direction === "incoming" && f.status === "completed")

  function startHeartbeat() {
    if (pingIntervalRef.current) return
    pingIntervalRef.current = setInterval(() => {
      if (peerRef.current?.connected) {
        try { peerRef.current.send(JSON.stringify({ type: "ping" } satisfies ControlMessage)) } catch { }
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  function stopHeartbeat() {
    if (!pingIntervalRef.current) return
    clearInterval(pingIntervalRef.current)
    pingIntervalRef.current = null
  }

  const handleIncomingData = useCallback(async (rawData: unknown) => {
    let raw: Uint8Array | null = null
    let msg: ControlMessage | null = null

    if (typeof rawData === "string") {
      try { msg = JSON.parse(rawData) } catch { }
    } else {
      const bytes = rawData instanceof Uint8Array ? rawData : rawData instanceof ArrayBuffer ? new Uint8Array(rawData) : null
      if (bytes) {
        raw = bytes
        if (bytes[0] === 0x7b) {
          try { msg = JSON.parse(new TextDecoder().decode(bytes)) } catch { }
        }
      }
    }

    if (msg?.type === "ping") { peerRef.current?.send(JSON.stringify({ type: "pong" } satisfies ControlMessage)); return }
    if (msg?.type === "pong") { lastPongRef.current = Date.now(); return }

    if (msg?.type === "file-meta") {
      const id = String(msg.id)
      const name = sanitizeFileName(msg.name)
      const size = Number.isFinite(msg.size) && msg.size >= 0 ? msg.size : 0
      const mimeType = typeof msg.mimeType === "string" && msg.mimeType ? msg.mimeType : "application/octet-stream"
      const createdAt = Number.isFinite(msg.createdAt) ? msg.createdAt : Date.now()
      const writer = await openOPFSWriter(id)
      currentReceiveRef.current = { id, name, size, mimeType, createdAt, writableStream: writer, blobParts: [], receivedBytes: 0, checksum: 1, lastReportedPct: -1 }
      upsertFile({ id, name, size, mimeType, createdAt, direction: "incoming", status: "transferring", progress: 0 })
      void requestWakeLock(wakeLockRef)
      return
    }

    if (msg?.type === "file-cancel") {
      const id = String(msg.id)
      if (currentReceiveRef.current?.id === id) {
        if (currentReceiveRef.current.writableStream) void currentReceiveRef.current.writableStream.abort().catch(() => { })
        currentReceiveRef.current = null
      }
      upsertFile({ id, status: "cancelled" })
      return
    }

    if (msg?.type === "file-end") {
      const cur = currentReceiveRef.current
      if (!cur || cur.id !== String(msg.id)) return

      if (msg.checksum !== cur.checksum) {
        toast.error(`"${cur.name}" arrived corrupted. Ask the sender to share it again.`)
        upsertFile({ id: cur.id, status: "failed", error: "Checksum mismatch" })
        if (cur.writableStream) void cur.writableStream.abort().catch(() => { })
        currentReceiveRef.current = null
        return
      }

      let blob: Blob | null = null
      if (cur.writableStream) {
        try {
          await cur.writableStream.close()
          blob = await finalizeOPFSBlob(cur.id, cur.mimeType)
        } catch {
          blob = null
        }
      }
      if (!blob) blob = new Blob(cur.blobParts as BlobPart[], { type: cur.mimeType })

      currentReceiveRef.current = null
      upsertFile({ id: cur.id, status: "completed", progress: 100 })
      await persistIncomingBlob({ id: cur.id, name: cur.name, size: cur.size, mimeType: cur.mimeType, createdAt: cur.createdAt }, blob)
      void releaseWakeLock(wakeLockRef)
      toast.success(`"${cur.name}" received.`)
      return
    }

    if (!raw) return
    const cur = currentReceiveRef.current
    if (!cur) return
    cur.checksum = adler32(raw, cur.checksum)
    if (cur.writableStream) {
      try { await cur.writableStream.write(raw as unknown as BufferSource) }
      catch { cur.writableStream = null; cur.blobParts.push(raw) }
    } else {
      cur.blobParts.push(raw)
    }
    cur.receivedBytes += raw.byteLength
    const pct = cur.size > 0 ? Math.min(Math.floor((cur.receivedBytes / cur.size) * 100), 99) : 0
    if (pct !== cur.lastReportedPct) {
      cur.lastReportedPct = pct
      upsertFile({ id: cur.id, progress: pct })
    }
  }, [upsertFile, persistIncomingBlob])

  const enqueueIncomingData = useCallback((rawData: unknown) => {
    receiveQueueRef.current = receiveQueueRef.current
      .then(() => handleIncomingData(rawData))
      .catch((err) => {
        console.error(err)
        toast.error("Failed to process incoming data.")
      })
  }, [handleIncomingData])

  function iceConfig(): RTCConfiguration {
    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ]
    if (process.env.NEXT_PUBLIC_TURN_SERVER) {
      iceServers.push({
        urls: process.env.NEXT_PUBLIC_TURN_SERVER,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      })
    }
    return { iceServers }
  }

  function clearReceiveState() {
    const cur = currentReceiveRef.current
    currentReceiveRef.current = null
    if (cur?.writableStream) void cur.writableStream.abort().catch(() => { })
    void releaseWakeLock(wakeLockRef)
  }

  function resetPeer(opts: { manual: boolean }) {
    stopHeartbeat()
    clearReceiveState()
    markInterrupted()
    // Only show the "connection lost, reconnect" banner if we actually had a live connection.
    // A failed/timed-out first attempt should just return to the plain connect form —
    // the toast already explains what happened, and there is nothing to "reconnect" to.
    setConnectionState(opts.manual ? "idle" : connectedRef.current ? "disconnected" : "idle")
    connectedRef.current = false
    lastPongRef.current = null
    isInitiatorRef.current = false
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null }
    if (peerRef.current) { try { peerRef.current.destroy() } catch { } peerRef.current = null }
  }

  function attachPeerEvents(peer: any) {
    const pc: RTCPeerConnection | undefined = peer._pc
    if (pc) {
      // addEventListener (not the onX properties) so this never clobbers simple-peer's own
      // internal handlers, which it needs to actually complete the trickle:false handshake.
      pc.addEventListener("iceconnectionstatechange", () => console.info("[sendvia] iceConnectionState:", pc.iceConnectionState))
      pc.addEventListener("icegatheringstatechange", () => console.info("[sendvia] iceGatheringState:", pc.iceGatheringState))
      pc.addEventListener("icecandidateerror", (e: any) => console.warn("[sendvia] icecandidateerror:", e.errorText || e.errorCode || e))
      pc.addEventListener("icecandidate", (e) => {
        if (e.candidate) console.info("[sendvia] local candidate:", e.candidate.type, e.candidate.protocol)
      })
    }
    peer.on("data", enqueueIncomingData)
    peer.on("connect", () => {
      if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null }
      toast.success("Connected successfully.")
      setConnectionState("connected")
      startHeartbeat()
    })
    peer.on("close", () => {
      const manual = manualDisconnectRef.current
      manualDisconnectRef.current = false
      if (manual) toast.info("Disconnected.")
      else if (connectedRef.current) toast.info("Connection lost.")
      resetPeer({ manual })
    })
    peer.on("error", () => {
      toast.error("Connection failed. Make sure the other device is online and try again.")
      resetPeer({ manual: false })
    })
  }

  useEffect(() => {
    if (!socket) return
    if (!socket.connected) socket.connect()

    const handleSignal = ({ fromPeerId, data }: any) => {
      if (isInitiatorRef.current && peerRef.current) {
        peerRef.current.signal(data)
        if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null }
        return
      }
      if (!peerRef.current) {
        setConnectionState("connecting")
        setTargetId(fromPeerId)
        peerRef.current = new Peer({ initiator: false, trickle: false, config: iceConfig() })
        peerRef.current.signal(data)
        peerRef.current.on("signal", (answer: any) => socket.emit("signal", { toPeerId: fromPeerId, data: answer }))
        attachPeerEvents(peerRef.current)
      }
    }

    socket.on("signal", handleSignal)
    return () => {
      socket.off("signal", handleSignal)
      stopHeartbeat()
    }
  }, [socket, enqueueIncomingData])

  useEffect(() => {
    connectedRef.current = connectionState === "connected"
    if (connectedRef.current) lastPongRef.current = Date.now()
  }, [connectionState])

  useEffect(() => {
    if (!lastPongRef.current || connectionState !== "connected") return
    const interval = setInterval(() => {
      if (lastPongRef.current && Date.now() - lastPongRef.current > HEARTBEAT_TIMEOUT_MS) {
        toast.info("Connection lost.")
        resetPeer({ manual: false })
      }
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [connectionState])

  useEffect(() => {
    if (connectionState === "connected" || isTransferring) {
      void requestWakeLock(wakeLockRef)
      return
    }
    void releaseWakeLock(wakeLockRef)
  }, [connectionState, isTransferring])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      if (connectedRef.current || isTransferring) void requestWakeLock(wakeLockRef)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      void releaseWakeLock(wakeLockRef)
    }
  }, [isTransferring])

  function signaling(isReconnect: boolean) {
    const sanitizedTarget = targetId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (sanitizedTarget.length < 8) { toast.error("Enter the full device code first."); return }
    if (sanitizedTarget === peerId) { toast.error("You can't connect to your own device code."); return }
    if (!socket?.connected) { toast.error("Not connected to the signaling server. Check your connection and try again."); return }

    clearReceiveState()
    setConnectionState(isReconnect ? "reconnecting" : "connecting")
    isInitiatorRef.current = true
    stopHeartbeat()
    peerRef.current = new Peer({ initiator: true, trickle: false, config: iceConfig() })
    peerRef.current.on("signal", (offer: any) => socket.emit("signal", { toPeerId: sanitizedTarget, data: offer }))
    attachPeerEvents(peerRef.current)
    connectTimeoutRef.current = setTimeout(() => {
      if (!connectedRef.current) {
        toast.error("Connection timed out. Double-check the code and make sure the other device is online.")
        resetPeer({ manual: false })
      }
    }, CONNECT_TIMEOUT_MS)
    setTargetId(sanitizedTarget)
  }

  function queueFiles(pickedFiles: File[]) {
    const peer = peerRef.current
    if (!peer?.connected) { toast.error("Not connected. Connect to a device first."); return }
    for (const file of pickedFiles) {
      const id = generateId()
      upsertFile({ id, name: sanitizeFileName(file.name), size: file.size, mimeType: file.type || "application/octet-stream", direction: "outgoing", status: "pending", progress: 0, createdAt: Date.now() })
      sendQueueRef.current = sendQueueRef.current
        .then(() => sendOneFile(id, file))
        .catch((err) => {
          console.error(err)
          upsertFile({ id, status: "failed", error: "Transfer failed" })
        })
    }
  }

  async function sendOneFile(id: string, file: File) {
    if (cancelledRef.current.has(id)) {
      cancelledRef.current.delete(id)
      upsertFile({ id, status: "cancelled" })
      return
    }
    const peer = peerRef.current
    if (!peer?.connected) { upsertFile({ id, status: "failed", error: "Disconnected before transfer started" }); return }
    const channel: RTCDataChannel = peer._channel

    function waitForDrain(): Promise<void> {
      return new Promise((resolve) => {
        if (channel.bufferedAmount <= RESUME_BUFFER_BYTES) { resolve(); return }
        channel.bufferedAmountLowThreshold = RESUME_BUFFER_BYTES
        const handler = () => { channel.removeEventListener("bufferedamountlow", handler); resolve() }
        channel.addEventListener("bufferedamountlow", handler)
      })
    }

    upsertFile({ id, status: "transferring", progress: 0 })
    try {
      peer.send(JSON.stringify({ type: "file-meta", id, name: file.name, size: file.size, mimeType: file.type || "application/octet-stream", createdAt: Date.now() } satisfies ControlMessage))
      let offset = 0, checksum = 1, lastPct = -1
      while (offset < file.size) {
        if (cancelledRef.current.has(id)) {
          cancelledRef.current.delete(id)
          try { peer.send(JSON.stringify({ type: "file-cancel", id } satisfies ControlMessage)) } catch { }
          upsertFile({ id, status: "cancelled" })
          return
        }
        if (!peer.connected) throw new Error("Connection lost mid-transfer")
        if (channel.bufferedAmount > MAX_BUFFER_BYTES) await waitForDrain()
        const slice = file.slice(offset, offset + CHUNK_SIZE)
        const buf = await slice.arrayBuffer()
        const u8 = new Uint8Array(buf)
        checksum = adler32(u8, checksum)
        peer.send(u8)
        offset += u8.byteLength
        const pct = Math.min(Math.floor((offset / file.size) * 100), 99)
        if (pct !== lastPct) { lastPct = pct; upsertFile({ id, progress: pct }) }
      }
      peer.send(JSON.stringify({ type: "file-end", id, checksum } satisfies ControlMessage))
      upsertFile({ id, status: "completed", progress: 100 })
    } catch (err) {
      console.error(err)
      upsertFile({ id, status: "failed", error: "Transfer interrupted" })
    }
  }

  function cancelOutgoingFile(id: string) {
    cancelledRef.current.add(id)
  }

  function CopyToClipboard(mouseLeave: boolean) {
    if (mouseLeave) setTimeout(() => setIsCopied(false), 500)
    else setIsCopied(true)
  }

  async function copyPeerId() {
    if (!peerId) return
    try {
      await navigator.clipboard.writeText(peerId)
      CopyToClipboard(false)
    } catch {
      toast.error("Couldn't copy the code. Select and copy it manually.")
    }
  }

  function disconnect() {
    manualDisconnectRef.current = true
    resetPeer({ manual: true })
  }

  function handleClearIncoming() {
    const count = files.filter((f) => f.direction === "incoming" && f.status === "completed").length
    if (count === 0) return
    const confirmed = window.confirm(
      `Remove ${count} received file${count > 1 ? "s" : ""} from this device? This only affects this device — the sender still has their copy.`
    )
    if (!confirmed) return
    void clearAllIncoming()
    toast.success("Cleared shared files from this device.")
  }

  const showConnectForm = connectionState === "idle" || connectionState === "disconnected"
  const showFileList = connectionState !== "idle" || files.length > 0

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors text-slate-900 dark:text-white">
      <Navbar page="sharing" />
      <section className="py-16">
        <div className="mx-auto w-full max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-14 items-start">
          <div className="w-full space-y-6">
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Your device code</p>
                <ConnectionBadge state={connectionState} />
              </div>

              <div className="text-center py-6 bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden">
                {peerId ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={copyPeerId}
                        onMouseLeave={() => CopyToClipboard(true)}
                        aria-label="Copy your device code"
                        className="break-all text-sm sm:text-2xl font-semibold tracking-widest font-mono"
                      >
                        {peerId}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{isCopied ? "Copied!" : "Click to copy"}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-sm text-gray-500">Generating device code…</span>
                )}
              </div>

              {connectionState === "connected" && (
                <>
                  <p className="text-sm text-gray-500 mt-4">Connected with device</p>
                  <div className="text-center py-6 bg-gray-100 dark:bg-slate-800 rounded-xl font-mono">{targetId}</div>
                  <Button type="button" variant="outline" className="w-full" onClick={disconnect}>Disconnect</Button>
                </>
              )}

              {connectionState === "disconnected" && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Connection to {targetId || "the other device"} was lost. Files you already received are still safe below.
                  </p>
                  <Button type="button" className="w-full" onClick={() => signaling(true)}>Reconnect</Button>
                </div>
              )}

              {(connectionState === "connecting" || connectionState === "reconnecting") && (
                <p className="text-sm text-gray-500 text-center">
                  {connectionState === "reconnecting" ? "Reconnecting" : "Connecting"} to {targetId || "device"}…
                </p>
              )}
            </div>

            {showConnectForm && (
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-md space-y-4">
                <label htmlFor="target-code" className="block text-sm text-gray-500">
                  Enter the other device&apos;s code
                </label>
                <input
                  id="target-code"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="Enter code to connect…"
                  maxLength={8}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-transparent px-4 py-3 outline-none focus:ring-2 focus:ring-slate-400"
                />
                <Button type="button" className="w-full" disabled={targetId.length < 8} onClick={() => signaling(false)}>
                  Connect
                </Button>
              </div>
            )}
          </div>

          <div className="w-full space-y-6">
            {connectionState === "connected" && <ShareDropzone onShare={queueFiles} />}

            {showFileList && (
              <FileList
                files={files}
                onDownload={downloadFile}
                onDeleteIncoming={deleteIncomingFile}
                onCancelOutgoing={cancelOutgoingFile}
                onClearIncoming={handleClearIncoming}
                hasClearableIncoming={hasClearableIncoming}
              />
            )}

            {!showFileList && connectionState === "idle" && <DeviceOrbit />}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}

import { useEffect, useState } from "react"
import styles from '@/components/ui/style.module.css'
import { Laptop, Smartphone, Tablet, Wifi } from "lucide-react"

export default function DeviceOrbit() {
  const messages = [
    "Searching devices...",
    "Connecting securely...",
    "Encrypted channel ready 🔒",
    "Waiting for transfer..."
  ]

  const [text, setText] = useState(messages[0])

  useEffect(() => {
    const id = setInterval(() => {
      setText(messages[Math.floor(Math.random() * messages.length)])
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const devices = [
    { icon: Smartphone, name: "Mobile", class: styles.float1 },
    { icon: Laptop, name: "Laptop", class: styles.float2 },
    { icon: Tablet, name: "Tablet", class: styles.float3 }
  ]

  return (
    <div className="flex flex-col items-center gap-8">

      <div className={styles.container}>

        {/* soft dotted rings (very light) */}
        <div className={styles.ringOuter} />
        <div className={styles.ringInner} />

        {/* center hub */}
        <div className={`${styles.center} bg-slate-900 dark:bg-white flex items-center justify-center`}>
          <Wifi size={22} />
        </div>

        {/* floating devices */}
        {devices.map((d, i) => {
          const Icon = d.icon
          return (
            <div key={i} className={`${styles.device} ${d.class}`}>
              <Icon size={26} />
              <span className="text-xs text-gray-500">{d.name}</span>
            </div>
          )
        })}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
        {text}
      </p>
    </div>
  )
}
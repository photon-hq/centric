import Image from 'next/image'

export default function PhotonLogo({ className = "w-full h-full" }: { className?: string }) {
  return (
    <div className={`relative ${className} overflow-hidden`}>
      <Image 
        src="/photon-logo.png" 
        alt="Photon Logo" 
        fill
        className="object-cover scale-150"
        priority
      />
    </div>
  )
}

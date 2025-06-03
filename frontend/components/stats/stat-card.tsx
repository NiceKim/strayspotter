interface StatCardProps {
    value: number | string
    label: string
    isLoading?: boolean
  }
  
  export default function StatCard({ value, label, isLoading = false }: StatCardProps) {
    return (
      <div className="text-center">
        <div className="text-4xl md:text-5xl font-bold text-black mb-2">
          {isLoading ? <div className="animate-pulse bg-gray-200 h-12 w-16 rounded mx-auto"></div> : value}
        </div>
        <p className="text-gray-600 font-medium">{label}</p>
      </div>
    )
  }
  
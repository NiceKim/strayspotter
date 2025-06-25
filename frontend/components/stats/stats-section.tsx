import StatCard from "./stat-card"

interface StatsSectionProps {
  stats: {
    day: number
    week: number
    month: number
  }
  isLoading: boolean
}

export default function StatsSection({ stats, isLoading }: StatsSectionProps) {
  const statItems = [
    {
      value: stats.day,
      label: "Strays Spotted Today",
    },
    {
      value: stats.week,
      label: "Weekly Total",
    },
    {
      value: stats.month,
      label: "Monthly Total",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
      {statItems.map((item, index) => (
        <StatCard key={index} value={item.value} label={item.label} isLoading={isLoading} />
      ))}
    </div>
  )
}

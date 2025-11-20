import { CustomerStats } from '@/types/customer-details'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Briefcase, CheckCircle, Clock, DollarSign, TrendingUp, Calendar } from 'lucide-react'

interface CustomerStatsGridProps {
  stats: CustomerStats
}

export function CustomerStatsGrid({ stats }: CustomerStatsGridProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No activity yet'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const statCards = [
    {
      label: 'Total Jobs',
      value: stats.totalJobs.toString(),
      icon: Briefcase,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: 'Open Jobs',
      value: stats.openJobs.toString(),
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
    },
    {
      label: 'Completed Jobs',
      value: stats.completedJobs.toString(),
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      label: 'Total Invoiced',
      value: formatCurrency(stats.totalInvoiced),
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      isCurrency: true,
    },
    {
      label: 'Total Paid',
      value: formatCurrency(stats.totalPaid),
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950',
      isCurrency: true,
    },
    {
      label: 'Outstanding Balance',
      value: formatCurrency(stats.outstandingBalance),
      icon: DollarSign,
      color: stats.outstandingBalance > 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-600 dark:text-gray-400',
      bgColor: stats.outstandingBalance > 0
        ? 'bg-red-50 dark:bg-red-950'
        : 'bg-gray-50 dark:bg-gray-800',
      isCurrency: true,
      highlight: stats.outstandingBalance > 0,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className={stat.highlight ? 'border-red-200 dark:border-red-800' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Last Activity */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800">
              <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Last Activity
              </p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {formatDate(stats.lastActivity)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

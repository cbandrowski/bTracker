"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      formatters={{
        formatWeekdayName: (date) => {
          return date.toLocaleDateString('en-US', { weekday: 'narrow' })
        },
      }}
      classNames={{
        month_caption: "flex justify-center pt-1 relative items-center pb-3",
        caption_label: "text-lg font-semibold text-white",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          "absolute left-1 h-9 w-9 bg-transparent p-0 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all inline-flex items-center justify-center"
        ),
        button_next: cn(
          "absolute right-1 h-9 w-9 bg-transparent p-0 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all inline-flex items-center justify-center"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-gray-400 rounded-md w-10 font-medium text-xs",
        week: "flex w-full mt-1",
        day: cn(
          "h-10 w-10 p-0 font-normal rounded-lg flex items-center justify-center text-gray-200 hover:bg-gray-700 hover:text-white transition-all cursor-pointer"
        ),
        day_button: cn(
          "h-10 w-10 p-0 font-normal rounded-lg flex items-center justify-center"
        ),
        selected: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white font-semibold",
        today: "bg-gray-700 text-white font-semibold ring-1 ring-gray-600",
        outside: "text-gray-600 hover:text-gray-500 opacity-50",
        disabled: "text-gray-700 opacity-40 cursor-not-allowed hover:bg-transparent",
        range_middle: "bg-blue-600/20 text-white",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (props) => {
          if (props.orientation === "left") {
            return <ChevronLeft className="h-5 w-5" />
          }
          return <ChevronRight className="h-5 w-5" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

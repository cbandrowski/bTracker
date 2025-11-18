/**
 * Employee Filter Component
 * Dropdown to filter by employee
 */

'use client'

interface Employee {
  id: string
  full_name: string
  job_title?: string
}

interface EmployeeFilterProps {
  employees: Employee[]
  selectedEmployeeId: string | null
  onEmployeeChange: (employeeId: string | null) => void
}

export default function EmployeeFilter({
  employees,
  selectedEmployeeId,
  onEmployeeChange,
}: EmployeeFilterProps) {
  return (
    <div className="flex flex-col">
      <label htmlFor="employee-filter" className="text-sm font-medium text-gray-300 mb-1">
        Employee
      </label>
      <select
        id="employee-filter"
        value={selectedEmployeeId || ''}
        onChange={(e) => onEmployeeChange(e.target.value || null)}
        className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Employees</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.full_name} {employee.job_title ? `(${employee.job_title})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

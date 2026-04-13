import { Suspense } from "react"
import StudentManagementClient from "./StudentManagementClient"

export default function StudentManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="teacher-panel p-5">
          <p className="teacher-helper">Loading student management...</p>
        </div>
      }
    >
      <StudentManagementClient />
    </Suspense>
  )
}

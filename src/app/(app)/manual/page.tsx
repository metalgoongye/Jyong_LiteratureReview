import { ManualEntryForm } from '@/components/literature/ManualEntryForm'

export default function ManualEntryPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-semibold text-lg">직접 입력</h1>
        <p className="text-sm opacity-40 mt-1">문헌 정보를 직접 입력하거나 PDF를 업로드하세요. AI 분석은 선택 사항입니다.</p>
      </div>
      <ManualEntryForm />
    </div>
  )
}

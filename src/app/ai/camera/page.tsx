import { PageHeader } from '@/components/ui/PageHeader';
import { CameraWorkbench } from '@/components/ai/camera/CameraWorkbench';

export default function AiCameraPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Camera"
        subtitle="Explicit browser permission, on-demand snapshots, and bounded frame sampling only."
      />
      <CameraWorkbench />
    </main>
  );
}

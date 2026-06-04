"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Film, GripVertical, Trash2 } from "lucide-react";
import type { UploadedClip } from "@/lib/types";

interface ClipListProps {
  clips: UploadedClip[];
  onReorder: (clips: UploadedClip[]) => void;
  onUpdate: (id: string, patch: Partial<UploadedClip>) => void;
  onRemove: (id: string) => void;
}

function SortableClipRow({
  clip,
  order,
  onUpdate,
  onRemove,
}: {
  clip: UploadedClip;
  order: number;
  onUpdate: (id: string, patch: Partial<UploadedClip>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#242424] border border-[#333333] rounded-lg p-3 mt-2 flex items-center gap-3"
    >
      <span className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333333] text-[10px] text-[#888888] flex items-center justify-center shrink-0">
        {order}
      </span>
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-[#555555] shrink-0 touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center shrink-0">
        <Film className="w-4 h-4 text-[#555555]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#EFEFEF] truncate">{clip.file.name}</p>
        {clip.duration != null && (
          <p className="text-xs text-[#888888]">
            {clip.duration.toFixed(1)}s
            {clip.uploading && " · uploading..."}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          min={0}
          step={0.1}
          placeholder="0"
          value={clip.trim_start || ""}
          onChange={(e) =>
            onUpdate(clip.id, { trim_start: parseFloat(e.target.value) || 0 })
          }
          className="w-10 text-xs bg-[#1a1a1a] border border-[#333333] rounded px-1 py-1 text-[#EFEFEF] text-center"
          title="Trim start (sec)"
        />
        <span className="text-[#555555] text-xs">→</span>
        <input
          type="number"
          min={0}
          step={0.1}
          placeholder="0"
          value={clip.trim_end || ""}
          onChange={(e) =>
            onUpdate(clip.id, { trim_end: parseFloat(e.target.value) || 0 })
          }
          className="w-10 text-xs bg-[#1a1a1a] border border-[#333333] rounded px-1 py-1 text-[#EFEFEF] text-center"
          title="Trim end (sec)"
        />
      </div>
      <button
        type="button"
        onClick={() => onRemove(clip.id)}
        className="text-[#888888] hover:text-red-400 ml-1 shrink-0"
        aria-label="Remove clip"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ClipList({ clips, onReorder, onUpdate, onRemove }: ClipListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = clips.findIndex((c) => c.id === active.id);
    const newIndex = clips.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(clips, oldIndex, newIndex).map((c, i) => ({
      ...c,
      order: i,
    }));
    onReorder(reordered);
  };

  if (clips.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={clips.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {clips.map((clip, idx) => (
          <SortableClipRow
            key={clip.id}
            clip={clip}
            order={idx + 1}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

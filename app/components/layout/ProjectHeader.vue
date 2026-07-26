<script setup lang="ts">
import type { Project } from "~/types";

defineProps<{
  project: Project;
  subtitle?: string;
}>();
</script>

<template>
  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex min-w-0 items-center gap-3">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        :style="{ backgroundColor: project.color }"
      >
        {{ project.name[0]?.toUpperCase() }}
      </div>
      <div class="min-w-0">
        <h1 class="truncate text-xl font-bold text-slate-900">
          {{ project.name }}
          <span v-if="subtitle" class="font-semibold text-slate-500"> — {{ subtitle }}</span>
        </h1>
        <p v-if="project.description && !$slots.actions" class="truncate text-sm text-slate-500">
          {{ stripMarkdownForPreview(project.description) }}
        </p>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 self-start sm:self-auto">
      <slot name="actions" />
    </div>
  </div>
</template>

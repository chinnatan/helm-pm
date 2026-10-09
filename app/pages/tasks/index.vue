<script setup lang="ts">
definePageMeta({ middleware: "auth" });

await navigateTo({ path: "/tasks/board", query: useRoute().query }, { replace: true });
</script>

<template>
  <div />
</template>

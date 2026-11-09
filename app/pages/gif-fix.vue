<script setup lang="ts">
import {
  encodeGif,
  effectiveDelay,
  frameDifference,
  parseGifMeta,
  planFrames,
  type GifMeta,
  type PlannedFrame,
} from "~/util/gif-codec";

useHead({
  title: "Gif Fix - GIF Frame Reducer",
});

definePageMeta({
  name: "GifFix",
});

// Every 4th frame is dropped
const DROP_EVERY = 4;
// Mean per-channel difference (0-255) above which an output frame is flagged
const CHECK_TOLERANCE = 12;

interface GifStats {
  frames: number;
  durationCs: number;
}

const sourceFile = ref<File | null>(null);
const sourceStats = ref<GifStats | null>(null);
const resultFile = ref<File | null>(null);
const resultStats = ref<GifStats | null>(null);
const originalUrl = ref("");
const resultUrl = ref("");
const isProcessing = ref(false);
const errorMessage = ref("");
const warningMessage = ref("");

// GIF with frames dropped, before gifsicle. Kept so moving the lossy slider only
// reruns the compression step.
let resampled: {
  blob: Blob;
  plan: PlannedFrame[];
  frames: Uint8ClampedArray[];
  colorsReduced: boolean;
} | null = null;

const lossyLevels = [0, 30, 60, 100];
const lossyNames = ["Off", "Light", "Medium", "Strong"];
const lossyIndex = ref(0);
const lossyLevel = computed(() => lossyLevels[lossyIndex.value] ?? 0);
const lossyLabel = computed(() => {
  const name = lossyNames[lossyIndex.value] ?? "Off";
  return lossyLevel.value === 0 ? name : `${name} (${lossyLevel.value})`;
});

const sizeRatio = computed(() => {
  if (!sourceFile.value || !resultFile.value) return 0;
  return Math.round(
    ((sourceFile.value.size - resultFile.value.size) / sourceFile.value.size) * 100,
  );
});

function statsFromDelays(delays: number[]): GifStats {
  return {
    frames: delays.length,
    durationCs: delays.reduce((sum, d) => sum + effectiveDelay(d), 0),
  };
}

function formatStats(stats: GifStats | null): string {
  if (!stats) return "";
  const seconds = stats.durationCs / 100;
  const fps = seconds > 0 ? (stats.frames / seconds).toFixed(1).replace(/\.0$/, "") : "0";
  return `${stats.frames} frames · ${seconds.toFixed(1)}s · ${fps}fps`;
}

watchDebounced(
  lossyIndex,
  () => {
    if (sourceFile.value && resampled) {
      processGif();
    }
  },
  { debounce: 400 },
);

async function handleDropZoneFiles(files: File[]) {
  const file = files[0];
  if (!file) return;

  errorMessage.value = "";

  const isGif = file.type === "image/gif" || (await hasGifMagicBytes(file));
  if (!isGif) {
    errorMessage.value = "Please drop a GIF file.";
    return;
  }

  if (typeof ImageDecoder === "undefined") {
    errorMessage.value =
      "This browser cannot decode GIF frames (no ImageDecoder). Use Chrome or Edge.";
    return;
  }

  resetState();
  sourceFile.value = file;
  originalUrl.value = URL.createObjectURL(file);

  await processGif();
}

async function hasGifMagicBytes(file: File): Promise<boolean> {
  const header = await file.slice(0, 6).text();
  return header === "GIF87a" || header === "GIF89a";
}

// Renders the requested frames exactly as a browser would show them, with every
// earlier frame, palette and disposal rule already applied. Working from these
// finished pictures is what makes it safe to drop frames.
async function renderFrames(
  data: Blob,
  meta: GifMeta,
  indexes: number[],
): Promise<Uint8ClampedArray[]> {
  const decoder = new ImageDecoder({ data: await data.arrayBuffer(), type: "image/gif" });
  try {
    await decoder.completed;
    await decoder.tracks.ready;
    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
    if (frameCount !== meta.delays.length) {
      throw new Error(
        `Frame count mismatch (${frameCount} decoded, ${meta.delays.length} in file).`,
      );
    }

    const canvas = new OffscreenCanvas(meta.width, meta.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const rendered: Uint8ClampedArray[] = [];

    for (const frameIndex of indexes) {
      const { image } = await decoder.decode({ frameIndex });
      ctx.clearRect(0, 0, meta.width, meta.height);
      ctx.drawImage(image, 0, 0);
      image.close();
      rendered.push(ctx.getImageData(0, 0, meta.width, meta.height).data);
    }

    return rendered;
  } finally {
    decoder.close();
  }
}

async function resample(file: File) {
  const meta = parseGifMeta(await file.arrayBuffer());
  sourceStats.value = statsFromDelays(meta.delays);

  if (meta.delays.length < 2) {
    throw new Error("This GIF has only one frame - nothing to fix.");
  }

  const plan = planFrames(meta.delays, DROP_EVERY);
  const frames = await renderFrames(
    file,
    meta,
    plan.map((p) => p.index),
  );
  const { blob, reducedFrames } = encodeGif(
    meta.width,
    meta.height,
    meta.loopCount,
    frames.map((rgba, i) => ({ rgba, delayCs: plan[i]!.delayCs })),
  );

  return { blob, plan, frames, colorsReduced: reducedFrames.length > 0 };
}

// Compares what the finished GIF shows against the source frames it was built
// from, so a damaged frame is reported instead of quietly downloaded.
async function checkOutput(output: Blob, source: NonNullable<typeof resampled>): Promise<string> {
  const meta = parseGifMeta(await output.arrayBuffer());
  const rendered = await renderFrames(
    output,
    meta,
    meta.delays.map((_, i) => i),
  );

  // gifsicle merges identical neighbours, so match frames up by time
  const starts: number[] = [];
  let clock = 0;
  for (const delay of meta.delays) {
    starts.push(clock);
    clock += effectiveDelay(delay);
  }

  let time = 0;
  const bad: number[] = [];
  source.plan.forEach((planned, i) => {
    let outIndex = 0;
    while (outIndex + 1 < starts.length && starts[outIndex + 1]! <= time) outIndex++;
    if (frameDifference(source.frames[i]!, rendered[outIndex]!) > CHECK_TOLERANCE) bad.push(i + 1);
    time += planned.delayCs;
  });

  if (bad.length === 0) return "";
  const list = bad.length > 5 ? `${bad.slice(0, 5).join(", ")}...` : bad.join(", ");
  return `Check the result before using it: frame${bad.length > 1 ? "s" : ""} ${list} look different from the original.`;
}

let rerunQueued = false;

async function processGif() {
  if (!sourceFile.value) return;
  if (isProcessing.value) {
    // slider moved mid-run: redo with the latest level once this run finishes
    rerunQueued = true;
    return;
  }

  isProcessing.value = true;
  errorMessage.value = "";
  warningMessage.value = "";

  try {
    resampled ??= await resample(sourceFile.value);

    // Frame choice and timing are already final - gifsicle only shrinks the file
    const { default: gifsicle } = await import("gifsicle-wasm-browser");
    const lossy = lossyLevel.value > 0 ? ` --lossy=${lossyLevel.value}` : "";
    const out = await gifsicle.run({
      input: [{ file: resampled.blob, name: "1.gif" }],
      command: [`1.gif -O2${lossy} -o /out/out.gif`],
    });

    if (!out?.[0]) {
      throw new Error("GIF processing produced no output.");
    }

    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
    resultFile.value = out[0];
    resultUrl.value = URL.createObjectURL(out[0]);
    resultStats.value = statsFromDelays(parseGifMeta(await out[0].arrayBuffer()).delays);

    const checkWarning = await checkOutput(out[0], resampled);
    warningMessage.value =
      checkWarning ||
      (resampled.colorsReduced
        ? "Some frames had more than 256 colours once rendered, so similar colours were merged."
        : "");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    isProcessing.value = false;
    if (rerunQueued) {
      rerunQueued = false;
      processGif();
    }
  }
}

function downloadResult() {
  if (!resultFile.value || !sourceFile.value) return;

  const url = URL.createObjectURL(resultFile.value);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fixed_${sourceFile.value.name}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function startOver() {
  resetState();
  lossyIndex.value = 0;
}

function resetState() {
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
  sourceFile.value = null;
  sourceStats.value = null;
  resultFile.value = null;
  resultStats.value = null;
  resampled = null;
  originalUrl.value = "";
  resultUrl.value = "";
  errorMessage.value = "";
  warningMessage.value = "";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

onUnmounted(() => {
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
});
</script>

<template>
  <div class="p-4 min-h-full">
    <FileDropZone
      v-if="!sourceFile"
      accept="image/gif"
      :multiple="false"
      icon="image"
      title="Drag and drop a GIF here"
      button-text="Choose GIF"
      :disabled="isProcessing"
      @drop="handleDropZoneFiles"
      @input="handleDropZoneFiles"
      class="mb-4"
    />

    <div v-if="sourceFile" class="flex justify-center mb-4">
      <UButton :disabled="isProcessing" @click="startOver"> New GIF </UButton>
    </div>

    <div class="flex flex-col items-center gap-2 mb-6">
      <USlider v-model="lossyIndex" :min="0" :max="3" :step="1" class="w-64" />
      <span class="text-sm text-neutral-500 dark:text-neutral-400">
        Lossy compression: {{ lossyLabel }}
      </span>
    </div>

    <div v-if="isProcessing" class="text-center mb-6">
      <UBadge
        color="info"
        variant="subtle"
        size="lg"
        icon="i-lucide-loader-circle"
        class="[&>svg]:animate-spin"
      >
        Processing GIF...
      </UBadge>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :title="errorMessage"
      icon="i-lucide-circle-alert"
      class="mb-6"
    />

    <UAlert
      v-if="warningMessage"
      color="warning"
      variant="soft"
      :title="warningMessage"
      icon="i-lucide-triangle-alert"
      class="mb-6"
    />

    <UCard v-if="resultFile && sourceFile" :ui="{ body: 'p-4 sm:p-4' }">
      <div class="grid sm:grid-cols-2 gap-4 mb-4">
        <div class="text-center">
          <div class="font-medium mb-2">Original</div>
          <img :src="originalUrl" alt="Original GIF" class="max-w-full mx-auto rounded" />
          <div class="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            {{ formatFileSize(sourceFile.size) }} · {{ formatStats(sourceStats) }}
          </div>
        </div>
        <div class="text-center">
          <div class="font-medium mb-2">Fixed</div>
          <img :src="resultUrl" alt="Fixed GIF" class="max-w-full mx-auto rounded" />
          <div class="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            {{ formatFileSize(resultFile.size) }} · {{ formatStats(resultStats) }}
          </div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400 my-4">
            {{ formatFileSize(sourceFile.size) }} → {{ formatFileSize(resultFile.size) }}
            <span v-if="sizeRatio > 0" class="text-green-600 font-medium"
              >({{ sizeRatio }}% smaller)</span
            >
            <span v-else>(no size reduction)</span>
          </div>
          <UButton color="primary" @click="downloadResult"> Download </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

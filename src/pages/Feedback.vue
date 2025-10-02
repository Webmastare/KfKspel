<template>
  <div class="feedback-container">
    <div class="feedback-form">
      <h1>Feedback & Bugg-Rapport</h1>
      <p class="subtitle">
        Hjälp oss förbättra spelen genom att dela dina tankar, buggar eller nya spelidéer!
      </p>

      <form @submit.prevent="submitFeedback" class="form">
        <!-- Feedback Type -->
        <div class="form-group">
          <label for="type" class="form-label">Typ av feedback</label>
          <select id="type" v-model="formData.type" class="form-input" required>
            <option value="">Välj typ</option>
            <option value="bug">🐛 Bugg-rapport</option>
            <option value="feature">💡 Ny Spelidé</option>
            <option value="improvement">⭐ Förbättringsförslag</option>
            <option value="other">💬 Övrigt</option>
          </select>
        </div>

        <!-- Title -->
        <div class="form-group">
          <label for="title" class="form-label">Titel</label>
          <input
            id="title"
            type="text"
            v-model="formData.title"
            class="form-input"
            placeholder="Kort beskrivning av din feedback"
            required
          />
        </div>

        <!-- Email (optional) -->
        <div class="form-group">
          <label for="email" class="form-label">Email (valfritt)</label>
          <input
            id="email"
            type="email"
            v-model="formData.email"
            class="form-input"
            placeholder="För att vi ska kunna svara dig"
          />
        </div>

        <!-- Severity (only for bugs) -->
        <div v-if="formData.type === 'bug'" class="form-group">
          <label for="severity" class="form-label">Allvarlighetsgrad</label>
          <select id="severity" v-model="formData.severity" class="form-input">
            <option value="low">Låg - Mindre problem</option>
            <option value="medium">Medium - Påverkar spelupplevelsen</option>
            <option value="high">Hög - Spelet kraschar eller fungerar inte</option>
          </select>
        </div>

        <!-- Description -->
        <div class="form-group">
          <label for="description" class="form-label">Beskrivning</label>
          <textarea
            id="description"
            v-model="formData.description"
            class="form-textarea"
            rows="6"
            placeholder="Beskriv detaljerat vad som hänt, vad du förväntade dig, eller din idé..."
            required
          ></textarea>
        </div>

        <!-- File Upload -->
        <div class="form-group">
          <label class="form-label">Bilagor (bilder/videos)</label>
          <div
            class="file-upload-area"
            :class="{ 'drag-over': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleFileDrop"
            @click="fileInput?.click()"
          >
            <div class="upload-content">
              <span class="upload-icon">📎</span>
              <p>Klicka för att välja filer eller dra och släpp</p>
              <p class="upload-hint">
                Bilder: JPG, PNG, GIF, WebP | Videos: MP4, WebM, MOV | Max 30MB totalt
              </p>
            </div>
            <input
              ref="fileInput"
              type="file"
              multiple
              accept="image/*,video/*"
              @change="handleFileSelect"
              style="display: none"
            />
          </div>

          <!-- File List -->
          <div v-if="files.length > 0" class="file-list">
            <div class="file-size-summary">
              <div class="size-bar">
                <div
                  class="size-progress"
                  :style="{ width: `${(totalFileSize / (30 * 1024 * 1024)) * 100}%` }"
                ></div>
              </div>
              <p class="size-text">
                {{ formatFileSize(totalFileSize) }} / 30MB använt
                <span v-if="remainingFileSize > 0" class="remaining">
                  ({{ formatFileSize(remainingFileSize) }} kvar)
                </span>
              </p>
            </div>
            <div v-for="(file, index) in files" :key="index" class="file-item">
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">({{ formatFileSize(file.size) }})</span>
              </div>
              <button type="button" @click="removeFile(index)" class="remove-file-btn">×</button>
            </div>
          </div>
        </div>

        <!-- Browser Info -->
        <div class="form-group">
          <label class="form-label">Teknisk information</label>
          <div class="browser-info">
            <p><strong>Browser:</strong> {{ browserInfo.browser }}</p>
            <p><strong>OS:</strong> {{ browserInfo.os }}</p>
            <p><strong>Skärmupplösning:</strong> {{ browserInfo.resolution }}</p>
            <p><strong>Viewport:</strong> {{ browserInfo.viewport }}</p>
            <p><strong>Språk:</strong> {{ browserInfo.language }}</p>
            <p><strong>Tidszon:</strong> {{ browserInfo.timezone }}</p>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="form-actions">
          <button type="submit" class="submit-btn" :disabled="isSubmitting">
            {{ isSubmitting ? 'Skickar...' : 'Skicka Feedback' }}
          </button>
        </div>

        <!-- Success Message -->
        <div v-if="showSuccess" class="success-message">
          ✅ Tack för din feedback! Vi har tagit emot den och kommer att titta på den så snart som
          möjligt.
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { supabase } from '@/utils/supabase'

interface BrowserInfo {
  browser: string
  browserVersion: string
  os: string
  resolution: string
  viewport: string
  userAgent: string
  language: string
  timezone: string
}

const formData = reactive({
  type: '',
  title: '',
  email: '',
  severity: 'medium',
  description: '',
})

const files = ref<File[]>([])
const isDragOver = ref(false)
const isSubmitting = ref(false)
const showSuccess = ref(false)
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement>()
const browserInfo = ref<BrowserInfo>({
  browser: '',
  browserVersion: '',
  os: '',
  resolution: '',
  viewport: '',
  userAgent: '',
  language: '',
  timezone: '',
})

const totalFileSize = computed(() => files.value.reduce((sum, file) => sum + file.size, 0))

const remainingFileSize = computed(() => {
  const maxSize = 30 * 1024 * 1024 // 30MB
  return Math.max(0, maxSize - totalFileSize.value)
})

onMounted(() => {
  detectBrowserInfo()
})

function detectBrowserInfo() {
  const ua = navigator.userAgent

  // Detect browser and version
  let browser = 'Unknown'
  let browserVersion = 'Unknown'

  const chromeMatch = ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/)
  const firefoxMatch = ua.match(/Firefox\/(\d+\.\d+)/)
  const safariMatch = ua.match(/Version\/(\d+\.\d+(?:\.\d+)?).*Safari/)
  const edgeMatch = ua.match(/Edg\/(\d+\.\d+\.\d+\.\d+)/)

  if (edgeMatch) {
    browser = 'Edge'
    browserVersion = edgeMatch[1] || 'Unknown'
  } else if (chromeMatch && !ua.includes('Edg')) {
    browser = 'Chrome'
    browserVersion = chromeMatch[1] || 'Unknown'
  } else if (firefoxMatch) {
    browser = 'Firefox'
    browserVersion = firefoxMatch[1] || 'Unknown'
  } else if (safariMatch && !ua.includes('Chrome')) {
    browser = 'Safari'
    browserVersion = safariMatch[1] || 'Unknown'
  }

  // Detect OS with more detail
  let os = 'Unknown'
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11'
  else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1'
  else if (ua.includes('Windows NT 6.2')) os = 'Windows 8'
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS X')) {
    const macMatch = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/)
    os = macMatch ? `macOS ${macMatch[1]?.replace(/_/g, '.') || ''}` : 'macOS'
  } else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) {
    const androidMatch = ua.match(/Android (\d+(?:\.\d+)?)/)
    os = androidMatch ? `Android ${androidMatch[1]}` : 'Android'
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    const iosMatch = ua.match(/OS (\d+_\d+(?:_\d+)?)/)
    os = iosMatch ? `iOS ${iosMatch[1]?.replace(/_/g, '.') || ''}` : 'iOS'
  }

  browserInfo.value = {
    browser: `${browser} ${browserVersion}`,
    browserVersion,
    os,
    resolution: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: ua,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    addFiles(Array.from(target.files))
  }
}

function handleFileDrop(event: DragEvent) {
  isDragOver.value = false
  if (event.dataTransfer?.files) {
    addFiles(Array.from(event.dataTransfer.files))
  }
}

function addFiles(fileList: File[]) {
  const validTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/mov',
  ]

  const MAX_TOTAL_SIZE = 30 * 1024 * 1024 // 30MB total
  const currentTotalSize = files.value.reduce((sum, file) => sum + file.size, 0)

  const newFiles = fileList.filter((file) => {
    if (!validTypes.includes(file.type)) {
      errorMessage.value = `Filtypen ${file.type} stöds inte`
      return false
    }
    return true
  })

  // Check if adding these files would exceed the total limit
  const newFilesTotalSize = newFiles.reduce((sum, file) => sum + file.size, 0)
  if (currentTotalSize + newFilesTotalSize > MAX_TOTAL_SIZE) {
    const remainingSize = MAX_TOTAL_SIZE - currentTotalSize
    errorMessage.value = `Total filstorlek får inte överstiga 30MB. Du har ${formatFileSize(remainingSize)} kvar att använda.`
    return
  }

  files.value.push(...newFiles)
  errorMessage.value = ''
}

function removeFile(index: number) {
  files.value.splice(index, 1)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function uploadFiles(): Promise<string[]> {
  if (files.value.length === 0) return []

  // Create FormData with all files
  const formData = new FormData()
  files.value.forEach((file) => {
    formData.append('file', file)
  })

  const { data, error } = await supabase.functions.invoke('feedback/upload', {
    body: formData,
  })

  if (error) {
    throw new Error(`Failed to upload files: ${error.message}`)
  }

  if (data?.files) {
    return data.files.map((file: any) => file.filePath)
  }

  return []
}

async function submitFeedback() {
  if (isSubmitting.value) return

  // Check total file size before submission
  if (totalFileSize.value > 30 * 1024 * 1024) {
    errorMessage.value = 'Total filstorlek överstiger 30MB. Ta bort några filer innan du skickar.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    // Upload files first
    let filePaths: string[] = []
    if (files.value.length > 0) {
      filePaths = await uploadFiles()
    }

    // Insert feedback record
    const feedbackRecord = {
      type: formData.type,
      title: formData.title,
      email: formData.email || null,
      severity: formData.type === 'bug' ? formData.severity : null,
      description: formData.description,
      browser_info: JSON.stringify(browserInfo.value),
      media_urls: filePaths.length > 0 ? filePaths : null,
      status: 'open',
    }

    const { error } = await supabase.from('feedback').insert([feedbackRecord])

    if (error) {
      throw new Error('Failed to submit feedback')
    }

    // Reset form and show success
    Object.assign(formData, {
      type: '',
      title: '',
      email: '',
      severity: 'medium',
      description: '',
    })
    files.value = []
    showSuccess.value = true

    // Hide success message after 5 seconds
    setTimeout(() => {
      showSuccess.value = false
    }, 5000)
  } catch (error) {
    console.error('Submission error:', error)
    errorMessage.value =
      error instanceof Error ? error.message : 'Ett fel uppstod vid skickning av feedback'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/generalGames';
@use '@/styles/theme.scss';

.feedback-container {
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.feedback-form {
  width: 100%;
  max-width: 600px;
  background-color: var(--theme-sidebar-bg);
  border-radius: 12px;
  padding: 30px;
  box-shadow: var(--theme-shadow-lg);
  margin-top: 40px;

  h1 {
    text-align: center;
    color: var(--theme-modal-header);
    margin-bottom: 8px;
    font-size: 2.5rem;
  }

  .subtitle {
    text-align: center;
    color: var(--theme-text-secondary);
    margin-bottom: 30px;
    font-size: 1.1rem;
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  @extend .form-label;
  font-weight: 600;
  color: var(--theme-modal-header);
}

.form-input,
.form-textarea {
  @extend .form-input;
  padding: 12px;
  font-size: 1rem;
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
  font-family: inherit;
}

.file-upload-area {
  border: 2px dashed var(--theme-border);
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--theme-bg-secondary);

  &:hover,
  &.drag-over {
    border-color: var(--theme-accent);
    background: var(--theme-bg-primary);
  }
}

.upload-content {
  .upload-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 10px;
  }

  p {
    margin: 0;
    color: var(--theme-text-primary);
  }

  .upload-hint {
    font-size: 0.9rem;
    color: var(--theme-text-secondary);
    margin-top: 8px;
  }
}

.file-list {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-size-summary {
  background: var(--theme-bg-secondary);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--theme-border);
  margin-bottom: 8px;

  .size-bar {
    width: 100%;
    height: 6px;
    background: var(--theme-border);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;

    .size-progress {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #ffc107, #f44336);
      transition: width 0.3s ease;
      border-radius: 3px;
    }
  }

  .size-text {
    margin: 0;
    font-size: 0.9rem;
    color: var(--theme-text-secondary);
    text-align: center;

    .remaining {
      color: var(--theme-accent);
      font-weight: 500;
    }
  }
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: var(--theme-bg-secondary);
  border-radius: 6px;
  border: 1px solid var(--theme-border);
}

.file-info {
  .file-name {
    font-weight: 500;
  }

  .file-size {
    color: var(--theme-text-secondary);
    font-size: 0.9rem;
    margin-left: 8px;
  }
}

.remove-file-btn {
  background: var(--theme-button-danger-bg);
  color: white;
  border: none;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;

  &:hover {
    background: var(--theme-button-danger-hover);
  }
}

.browser-info {
  background: var(--theme-bg-secondary);
  padding: 15px;
  border-radius: 6px;
  border: 1px solid var(--theme-border);

  p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--theme-text-secondary);

    strong {
      color: var(--theme-text-primary);
    }
  }
}

.form-actions {
  margin-top: 20px;
}

.submit-btn {
  @extend .button-base;
  width: 100%;
  padding: 15px;
  font-size: 1.1rem;
  font-weight: 600;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.success-message {
  background: linear-gradient(135deg, #4caf50, #45a049);
  color: white;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
  margin-top: 20px;
}

.error-message {
  @extend .error-message;
  margin-top: 15px;
}

@media (max-width: 768px) {
  .feedback-container {
    padding: 15px;
  }

  .feedback-form {
    padding: 20px;
    margin-top: 20px;

    h1 {
      font-size: 2rem;
    }
  }

  .file-upload-area {
    padding: 30px 15px;
  }
}
</style>

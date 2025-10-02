<template>
  <div class="admin-container">
    <!-- Admin Interface -->
    <div class="admin-interface">
      <div class="admin-header">
        <h1>Feedback Administration</h1>

        <!-- Fetch Button -->
        <div class="fetch-section">
          <button @click="fetchFeedback" class="fetch-button" :disabled="loading">
            {{ loading ? 'Laddar...' : 'Hämta Feedback Data' }}
          </button>
        </div>

        <div class="admin-stats" v-if="feedbackList.length > 0">
          <div class="stat-card">
            <span class="stat-number">{{ feedbackList.length }}</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">{{ openCount }}</span>
            <span class="stat-label">Öppna</span>
          </div>
          <div class="stat-card">
            <span class="stat-number">{{ closedCount }}</span>
            <span class="stat-label">Stängda</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <label>Status:</label>
          <select v-model="statusFilter" @change="fetchFeedback">
            <option value="">Alla</option>
            <option value="open">Öppna</option>
            <option value="in_progress">Pågående</option>
            <option value="closed">Stängda</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Typ:</label>
          <select v-model="typeFilter" @change="fetchFeedback">
            <option value="">Alla</option>
            <option value="bug">Buggar</option>
            <option value="feature">Spelidéer</option>
            <option value="improvement">Förbättringar</option>
            <option value="other">Övrigt</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Sortera:</label>
          <select v-model="sortBy" @change="fetchFeedback">
            <option value="created_at-desc">Senaste först</option>
            <option value="created_at-asc">Äldsta först</option>
            <option value="severity">Allvarlighetsgrad</option>
          </select>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading">Laddar feedback...</div>

      <!-- Error State -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Feedback List -->
      <div v-if="!loading && !error" class="feedback-list">
        <div
          v-for="feedback in feedbackList"
          :key="feedback.id"
          class="feedback-card"
          :class="{ expanded: expandedId === feedback.id }"
        >
          <div class="feedback-header" @click="toggleExpand(feedback.id)">
            <div class="feedback-title">
              <span class="type-badge" :class="feedback.type">
                {{ getTypeIcon(feedback.type) }}
              </span>
              <h3>{{ feedback.title }}</h3>
              <span v-if="feedback.severity" class="severity-badge" :class="feedback.severity">
                {{ feedback.severity.toUpperCase() }}
              </span>
            </div>

            <div class="feedback-meta">
              <span class="status-badge" :class="feedback.status">
                {{ getStatusText(feedback.status) }}
              </span>
              <span class="date">{{ formatDate(feedback.created_at) }}</span>
              <span class="expand-icon">{{ expandedId === feedback.id ? '▼' : '▶' }}</span>
            </div>
          </div>

          <div v-if="expandedId === feedback.id" class="feedback-content">
            <div class="content-section">
              <h4>Beskrivning</h4>
              <p class="description">{{ feedback.description }}</p>
            </div>

            <div v-if="feedback.email" class="content-section">
              <h4>Kontakt</h4>
              <p>{{ feedback.email }}</p>
            </div>

            <div
              v-if="feedback.media_urls && feedback.media_urls.length > 0"
              class="content-section"
            >
              <h4>Bilagor</h4>
              <div class="media-list">
                <div
                  v-for="(mediaUrl, index) in feedback.media_urls"
                  :key="index"
                  class="media-item"
                >
                  <button @click="viewMedia(mediaUrl)" class="media-button">
                    📎 {{ getMediaFilename(mediaUrl) }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="feedback.browser_info" class="content-section">
              <h4>Teknisk Information</h4>
              <div class="browser-info">
                <div
                  v-for="(value, key) in parseBrowserInfo(feedback.browser_info)"
                  :key="String(key)"
                >
                  <strong>{{ formatBrowserInfoKey(String(key)) }}:</strong> {{ value }}
                </div>
              </div>
            </div>

            <div class="content-section">
              <h4>Status & Anteckningar</h4>
              <div class="status-control">
                <select
                  v-model="feedback.status"
                  @change="updateFeedbackStatus(feedback.id, feedback.status)"
                >
                  <option value="open">Öppen</option>
                  <option value="in_progress">Pågående</option>
                  <option value="closed">Stängd</option>
                </select>
              </div>

              <textarea
                :value="feedback.admin_notes || ''"
                @input="feedback.admin_notes = ($event.target as HTMLTextAreaElement).value"
                @blur="updateFeedbackNotes(feedback.id, feedback.admin_notes || '')"
                placeholder="Lägg till anteckningar..."
                class="notes-textarea"
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- No Results -->
      <div
        v-if="!loading && !error && feedbackList.length === 0 && hasTriedFetching"
        class="no-results"
      >
        <p>Ingen feedback hittades med de valda filtren.</p>
        <p class="admin-notice">
          Om du inte kan se någon data kan det bero på att du inte har administratörsbehörighet.
        </p>
      </div>
    </div>
  </div>

  <!-- Media Modal -->
  <div v-if="showMediaModal" class="modal-overlay" @click="closeMediaModal">
    <div class="modal-content" @click.stop>
      <button class="modal-close" @click="closeMediaModal">×</button>
      <img
        v-if="currentMediaType === 'image'"
        :src="currentMediaUrl"
        alt="Feedback media"
        class="modal-media"
      />
      <video
        v-else-if="currentMediaType === 'video'"
        :src="currentMediaUrl"
        controls
        class="modal-media"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase'
import { useAuthStore } from '@/stores/auth'

interface Feedback {
  id: string
  type: string
  title: string
  email?: string
  severity?: string
  description: string
  browser_info?: string
  media_urls?: string[]
  status: string
  admin_notes?: string
  created_at: string
}

const router = useRouter()
const authStore = useAuthStore()

const feedbackList = ref<Feedback[]>([])
const loading = ref(false)
const error = ref('')
const expandedId = ref<string | null>(null)
const hasTriedFetching = ref(false)

// Filters
const statusFilter = ref('')
const typeFilter = ref('')
const sortBy = ref('created_at-desc')

// Media modal
const showMediaModal = ref(false)
const currentMediaUrl = ref('')
const currentMediaType = ref<'image' | 'video'>('image')

// Computed stats
const openCount = computed(() => feedbackList.value.filter((f) => f.status === 'open').length)
const closedCount = computed(() => feedbackList.value.filter((f) => f.status === 'closed').length)

async function fetchFeedback() {
  loading.value = true
  error.value = ''
  hasTriedFetching.value = true

  try {
    let query = supabase.from('feedback').select('*')

    // Apply filters
    if (statusFilter.value) {
      query = query.eq('status', statusFilter.value)
    }
    if (typeFilter.value) {
      query = query.eq('type', typeFilter.value)
    }

    // Apply sorting
    const [column, direction] = sortBy.value.split('-')
    const ascending = direction === 'asc'

    // Special handling for severity sorting
    if (column === 'severity') {
      query = query
        .order('severity', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    } else if (column) {
      query = query.order(column, { ascending })
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      error.value = 'Kunde inte ladda feedback. Ett fel uppstod vid hämtning av data.'
      return
    }

    feedbackList.value = data || []
  } catch (err) {
    console.error('Fetch error:', err)
    error.value = 'Ett fel uppstod vid laddning av feedback.'
  } finally {
    loading.value = false
  }
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

async function updateFeedbackStatus(id: string, status: string) {
  try {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id)

    if (error) {
      console.error('Update error:', error)
      // Revert the change
      const feedback = feedbackList.value.find((f) => f.id === id)
      if (feedback) {
        await fetchFeedback() // Refresh to get correct status
      }
    }
  } catch (err) {
    console.error('Update error:', err)
  }
}

async function updateFeedbackNotes(id: string, notes: string) {
  try {
    const { error } = await supabase.from('feedback').update({ admin_notes: notes }).eq('id', id)

    if (error) {
      console.error('Update error:', error)
    }
  } catch (err) {
    console.error('Update error:', err)
  }
}

function getTypeIcon(type: string): string {
  const icons = {
    bug: '🐛',
    feature: '💡',
    improvement: '⭐',
    other: '💬',
  }
  return icons[type as keyof typeof icons] || '📝'
}

function getStatusText(status: string): string {
  const statusTexts = {
    open: 'Öppen',
    in_progress: 'Pågående',
    closed: 'Stängd',
  }
  return statusTexts[status as keyof typeof statusTexts] || status
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseBrowserInfo(browserInfoString: string) {
  try {
    return JSON.parse(browserInfoString)
  } catch {
    return {}
  }
}

function formatBrowserInfoKey(key: string): string {
  const keyMap: Record<string, string> = {
    browser: 'Browser',
    os: 'OS',
    resolution: 'Skärmupplösning',
    viewport: 'Viewport',
    language: 'Språk',
    timezone: 'Tidszon',
  }
  return keyMap[key] || key
}

function getMediaFilename(url: string): string {
  return url.split('/').pop() || 'Fil'
}

async function viewMedia(mediaPath: string) {
  try {
    const { data } = await supabase.storage.from('feedback-media').createSignedUrl(mediaPath, 3600) // 1 hour expiry

    if (data?.signedUrl) {
      currentMediaUrl.value = data.signedUrl
      currentMediaType.value =
        mediaPath.toLowerCase().includes('.mp4') ||
        mediaPath.toLowerCase().includes('.webm') ||
        mediaPath.toLowerCase().includes('.mov')
          ? 'video'
          : 'image'
      showMediaModal.value = true
    }
  } catch (err) {
    console.error('Error creating signed URL:', err)
  }
}

function closeMediaModal() {
  showMediaModal.value = false
  currentMediaUrl.value = ''
}
</script>

<style scoped lang="scss">
@use '@/styles/generalGames';
@use '@/styles/theme.scss';

.admin-container {
  min-height: 100vh;
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  padding: 20px;
}

.admin-header {
  margin-bottom: 30px;

  h1 {
    color: var(--theme-modal-header);
    text-align: center;
    margin-bottom: 20px;
  }
}

.fetch-section {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;

  .fetch-button {
    @extend .button-base;
    background: var(--theme-button-primary-bg);
    color: white;
    padding: 15px 30px;
    font-size: 1.1rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--theme-button-primary-bg) 90%, black);
      transform: translateY(-2px);
      box-shadow: var(--theme-shadow-lg);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  }
}

.admin-stats {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 20px;

  .stat-card {
    background: var(--theme-sidebar-bg);
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    box-shadow: var(--theme-shadow-lg);
    min-width: 100px;

    .stat-number {
      display: block;
      font-size: 2rem;
      font-weight: bold;
      color: var(--theme-button-primary-bg);
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--theme-text-secondary);
    }
  }
}

.filters {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  flex-wrap: wrap;
  justify-content: center;

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 5px;

    label {
      font-weight: 600;
      color: var(--theme-text-primary);
      font-size: 0.9rem;
    }

    select {
      @extend .form-input;
      padding: 8px 12px;
    }
  }
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--theme-text-secondary);
}

.error-message {
  @extend .error-message;
  text-align: center;
  margin: 20px auto;
  max-width: 500px;
}

.feedback-list {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.feedback-card {
  background: var(--theme-sidebar-bg);
  border-radius: 12px;
  box-shadow: var(--theme-shadow-lg);
  overflow: hidden;
  transition: all 0.3s ease;

  &.expanded {
    box-shadow: var(--theme-shadow-xl);
  }
}

.feedback-header {
  padding: 20px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--theme-border);

  &:hover {
    background: var(--theme-bg-secondary);
  }
}

.feedback-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;

  .type-badge {
    font-size: 1.2rem;
  }

  h3 {
    margin: 0;
    color: var(--theme-text-primary);
    font-size: 1.1rem;
  }

  .severity-badge {
    background: #f44336;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;

    &.low {
      background: #4caf50;
    }
    &.medium {
      background: #ff9800;
    }
    &.high {
      background: #f44336;
    }
  }
}

.feedback-meta {
  display: flex;
  align-items: center;
  gap: 15px;

  .status-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;

    &.open {
      background: #e3f2fd;
      color: #1976d2;
    }

    &.in_progress {
      background: #fff3e0;
      color: #f57c00;
    }

    &.closed {
      background: #e8f5e8;
      color: #388e3c;
    }
  }

  .date {
    color: var(--theme-text-secondary);
    font-size: 0.9rem;
  }

  .expand-icon {
    color: var(--theme-button-primary-bg);
    font-weight: bold;
  }
}

.feedback-content {
  padding: 20px;
  border-top: 1px solid var(--theme-border);
  background: var(--theme-bg-secondary);
}

.content-section {
  margin-bottom: 25px;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    color: var(--theme-modal-header);
    margin: 0 0 10px 0;
    font-size: 1rem;
  }

  .description {
    white-space: pre-wrap;
    line-height: 1.5;
    margin: 0;
  }
}

.media-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.media-button {
  @extend .button-base;
  padding: 8px 16px;
  font-size: 0.9rem;
  background: var(--theme-button-secondary-bg);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }
}

.browser-info {
  background: var(--theme-bg-primary);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--theme-border);

  div {
    margin-bottom: 5px;
    font-size: 0.9rem;

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: var(--theme-text-primary);
    }
  }
}

.status-control {
  margin-bottom: 15px;

  select {
    @extend .form-input;
    padding: 8px 12px;
    width: 200px;
  }
}

.notes-textarea {
  @extend .form-input;
  width: 100%;
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: var(--theme-text-secondary);
  font-style: italic;

  p {
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .admin-notice {
    color: var(--theme-button-primary-bg);
    font-weight: 500;
    font-style: normal;
    background: var(--theme-sidebar-bg);
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid var(--theme-button-primary-bg);
    margin-top: 20px;
  }
}

// Modal styles
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: var(--theme-sidebar-bg);
  border-radius: 12px;
  overflow: hidden;
}

.modal-close {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 35px;
  height: 35px;
  font-size: 1.5rem;
  cursor: pointer;
  z-index: 1001;

  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }
}

.modal-media {
  max-width: 100%;
  max-height: 90vh;
  display: block;
}

@media (max-width: 768px) {
  .admin-stats {
    flex-direction: column;
    align-items: center;
  }

  .filters {
    flex-direction: column;
    align-items: center;
  }

  .feedback-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .feedback-meta {
    flex-wrap: wrap;
  }
}
</style>

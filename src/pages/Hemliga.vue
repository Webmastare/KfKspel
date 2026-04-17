<template>
  <main class="hemliga-page">
    <section class="hero-card">
      <h1>Spel under utveckling</h1>
      <p>
        Här samlas alla spel och experiment som inte visas på startsidan. Perfekt när du vill hitta
        det som fortfarande är under arbete eller bara gömmer sig lite.
      </p>
      <router-link to="/" class="return-home">Tillbaka till startsidan</router-link>
    </section>

    <section class="section-card">
      <div class="section-headline">
        <h2>Alla dolda spel</h2>
        <p>{{ allSecretGames.length }} st hittades</p>
      </div>

      <div class="secret-grid">
        <article v-for="game in allSecretGames" :key="game.path" class="secret-card">
          <div class="card-top">
            <h3>{{ game.title }}</h3>
          </div>
          <p class="route-label">{{ game.path }}</p>
          <router-link :to="game.path" class="open-link">Öppna</router-link>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { secretGameLinks } from '@/router/gameCatalog'

const allSecretGames = secretGameLinks
</script>

<style scoped lang="scss">
.hemliga-page {
  min-height: calc(100vh - 3rem);
  padding: 1.2rem;
  background:
    radial-gradient(circle at 15% 15%, rgba(45, 207, 105, 0.14), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(12, 141, 59, 0.18), transparent 50%),
    var(--theme-bg-primary);
  color: var(--theme-text-primary);
}

.hero-card,
.section-card {
  width: min(980px, 100%);
  margin: 0 auto;
  border: 1px solid var(--theme-border-light);
  border-radius: 18px;
  background: color-mix(in srgb, var(--theme-bg-secondary) 86%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: var(--theme-shadow-md);
}

.hero-card {
  padding: 1.4rem;
  margin-bottom: 1rem;

  h1 {
    font-size: clamp(1.8rem, 4vw, 2.5rem);
    margin-bottom: 0.65rem;
    line-height: 1.1;
  }

  p {
    color: var(--theme-text-secondary);
    max-width: 70ch;
  }
}

.return-home {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.55rem 0.9rem;
  border-radius: 12px;
  text-decoration: none;
  background: var(--theme-button-secondary-bg);
  color: var(--theme-button-secondary-text);
  border: 1px solid var(--theme-border-light);
  transition:
    transform 0.2s ease,
    filter 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }
}

.section-card {
  padding: 1.2rem;
}

.section-headline {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.8rem;

  h2 {
    font-size: 1.35rem;
  }

  p {
    color: var(--theme-text-secondary);
    font-size: 0.92rem;
  }
}

.secret-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.8rem;
}

.secret-card {
  border-radius: 14px;
  padding: 0.9rem;
  border: 1px solid var(--theme-border-light);
  background: color-mix(in srgb, var(--theme-bg-elevated) 88%, transparent);
  box-shadow: var(--theme-shadow-sm);
}

.card-top {
  display: flex;
  justify-content: flex-start;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.4rem;

  h3 {
    font-size: 1.03rem;
    line-height: 1.2;
  }
}
.route-label {
  font-size: 0.82rem;
  color: var(--theme-text-tertiary);
  margin-bottom: 0.65rem;
}

.open-link {
  display: inline-flex;
  text-decoration: none;
  border-radius: 10px;
  padding: 0.45rem 0.74rem;
  font-weight: 600;
  color: var(--theme-button-primary-text);
  background: var(--theme-button-primary-bg);
  border: 1px solid var(--theme-button-primary-border);
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }
}

@media (max-width: 600px) {
  .hemliga-page {
    padding: 0.8rem;
  }

  .hero-card,
  .section-card {
    border-radius: 14px;
  }
}
</style>

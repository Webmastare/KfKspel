<template>
  <div class="not-found-page">
    <h1>404 - Sidan hittades inte</h1>
    <p>Sidan du letar efter finns inte.</p>
    <router-link to="/" class="back-home-link">Gå tillbaka till Hem</router-link>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/theme.scss';
.not-found-page {
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.back-home-link {
  margin-top: 20px;
  padding: 12px 24px;
  background-color: var(--theme-bg-secondary);
  color: var(--theme-text-secondary);
  border-radius: 4px;
  text-decoration: none;

  &:hover {
    background-color: var(--theme-bg-tertiary);
  }
}
</style>

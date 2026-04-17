<template>
  <main class="about-page">
    <section class="hero">
      <p class="eyebrow">Om KfKSpel</p>
      <h1>Välkommen till KfKSpel</h1>
      <p>
        KfKSpel är en samlingsplats för diverse spel och små projekt. Sidan byggs och förbättras
        löpande av webmästeriet, och nya idéer kan dyka upp när som helst.
      </p>
      <div class="hero-actions">
        <router-link to="/" class="action-btn primary">Till startsidan</router-link>
        <router-link to="/feedback" class="action-btn secondary">Skicka feedback</router-link>
      </div>
    </section>

    <section class="about-section" id="om-sidan">
      <h2>Vad finns på sidan?</h2>
      <p>
        Här hittar du flera olika spel många kopior av redan etablerade spel och vissa hemmabyggen.
        Vissa spel har stöd för att spara framsteg om du är inloggad och vissa kan spara lokalt
        oavsett.
      </p>
    </section>

    <section class="about-section" id="datahantering">
      <h2>Hur vi hanterar användardata</h2>
      <p>
        Vi försöker samla in så lite information som möjligt. Syftet med informationen är framför
        allt att möjliggöra inloggning och molnlagring.
      </p>

      <h3>Data du själv lämnar</h3>
      <ul>
        <li>E-postadress för inloggning.</li>
        <li>Användarnamn och eventuellt namn i profil.</li>
        <li>Feedback som du väljer att skicka in.</li>
      </ul>

      <h3>Vad vi kan se</h3>
      <ul>
        <li>Kontouppgifter kopplade till ditt konto (t.ex. användarnamn och e-post).</li>
        <li>Dina framsteg och prestanda i spel.</li>
        <li>Information du själv skickar in via formulär på sidan.</li>
        <li>Teknisk information om din enhet i samband med feedback inskickning.</li>
      </ul>

      <h3>Vad vi inte gör</h3>
      <ul>
        <li>
          Vi delar inte dina uppgifter vidare, varken till andra på sektionen eller externa parter.
        </li>
        <li>Vi kan inte se ditt lösenord det är krypterat och sparat hos Supabase.</li>
      </ul>

      <h3>Ta bort ditt konto</h3>
      <p>
        Önskar du att ta bort ditt konto och all kopplad data kan du kontakta oss via feedbacksidan
        eller maila direkt till
        <a class="mail-link" href="mailto:webmästeriet@kfkb.se">webmästeriet@kfkb.se</a>. Ange i
        mailet att du vill radera ditt konto så återkommer vi så snart som möjligt när det är gjort.
      </p>
    </section>

    <section class="about-section" id="kontakt">
      <h2>Frågor eller synpunkter?</h2>
      <p>
        Om du undrar över villkor, data eller vill föreslå förbättringar kan du använda
        feedbacksidan.
      </p>
      <router-link to="/feedback" class="action-btn primary">Öppna feedback</router-link>
    </section>
  </main>
</template>

<style scoped lang="scss">
.about-page {
  min-height: calc(100vh - 3rem);
  padding: 2rem 1.25rem 3rem;
  color: var(--theme-text-primary);
  background:
    radial-gradient(circle at 15% 15%, rgba(45, 207, 105, 0.14), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(12, 141, 59, 0.18), transparent 50%),
    var(--theme-bg-primary);
}

.hero,
.about-section {
  width: min(920px, 100%);
  margin: 0 auto;
  background: color-mix(in srgb, var(--theme-bg-secondary) 92%, transparent);
  border: 1px solid var(--theme-border-light);
  border-radius: 18px;
  padding: 1.5rem;
  box-shadow: var(--theme-shadow-sm);
}

.hero {
  margin-bottom: 1rem;

  h1 {
    font-size: clamp(1.9rem, 5vw, 2.7rem);
    margin-bottom: 0.8rem;
    line-height: 1.15;
  }

  p {
    color: var(--theme-text-secondary);
    max-width: 70ch;
  }
}

.eyebrow {
  display: inline-block;
  margin-bottom: 0.7rem;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--theme-modal-header);
  font-weight: 700;
}

.hero-actions {
  margin-top: 1.2rem;
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.about-section {
  margin-bottom: 1rem;

  h2 {
    margin-bottom: 0.6rem;
    font-size: 1.35rem;
  }

  h3 {
    margin-top: 1rem;
    margin-bottom: 0.45rem;
    font-size: 1.05rem;
  }

  p {
    color: var(--theme-text-secondary);
    margin-bottom: 0.7rem;
    line-height: 1.5;
  }

  ul {
    margin-left: 1.1rem;
    color: var(--theme-text-secondary);
    line-height: 1.55;
  }
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-weight: 600;
  border-radius: 12px;
  border: 1px solid transparent;
  padding: 0.55rem 0.95rem;
  transition:
    transform 0.2s ease,
    filter 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    filter: brightness(1.02);
  }

  &:active {
    transform: translateY(0);
  }
}

.mail-link {
  color: var(--theme-modal-header);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    color: var(--theme-text-primary);
  }
}

.primary {
  background: var(--theme-button-primary-bg);
  color: var(--theme-button-primary-text);
  border-color: var(--theme-button-primary-border);
}

.secondary {
  background: var(--theme-button-secondary-bg);
  color: var(--theme-button-secondary-text);
  border-color: var(--theme-border-light);
}

@media (max-width: 640px) {
  .about-page {
    padding: 1rem 0.8rem 2rem;
  }

  .hero,
  .about-section {
    padding: 1.1rem;
    border-radius: 14px;
  }
}
</style>

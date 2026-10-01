<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { activity, fetchLatestPush, timeAgo } from "../activity";
import ContributionGraph from "../components/ContributionGraph.vue";
import LanguageMix from "../components/LanguageMix.vue";
import ProjectCard from "../components/ProjectCard.vue";
import StatCount from "../components/StatCount.vue";
import SystemMap from "../components/SystemMap.vue";
import { useReveal } from "../composables/useReveal";
import { bySlug, featured, profile, totals } from "../data";

useHead({
  title: null,
  link: [{ rel: "canonical", href: profile.site }],
  meta: [
    { property: "og:title", content: `${profile.name} · ${profile.role}` },
    { property: "og:description", content: profile.lede },
    { property: "og:url", content: profile.site },
  ],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Person",
        name: profile.name,
        alternateName: "Rex",
        jobTitle: profile.role,
        url: profile.site,
        sameAs: [profile.github],
        worksFor: { "@type": "Organization", name: profile.company },
      }),
    },
  ],
});

useReveal();

const now = profile.now.map((n) => ({ ...n, project: bySlug.get(n.slug)! }));

// The hero's "last push" line: build-time data first, then the browser asks GitHub for anything
// newer. Shown only when one of the two produced something; never a made-up value.
const latest = ref<{ repo: string; at: string } | null>(
  activity.recent?.[0] ? { repo: activity.recent[0].name, at: activity.recent[0].pushedAt } : null,
);
const controller = new AbortController();
onMounted(async () => {
  const live = await fetchLatestPush(profile.handle, controller.signal);
  if (live && (!latest.value || live.at > latest.value.at)) latest.value = live;
});
onBeforeUnmount(() => controller.abort());
const latestLine = computed(() =>
  latest.value ? `last push · ${latest.value.repo} · ${timeAgo(latest.value.at)}` : "github.com/tochi-mba",
);
</script>

<template>
  <div>
    <section class="hero container" id="top">
      <div class="hero-copy">
        <div class="eyebrow signal"><span class="pulse-dot"></span> {{ profile.name }} · call me Rex · {{ profile.company }}</div>
        <h1>
          <span class="headline-line">Agent systems</span>
          <span class="headline-line"><span>that ship.</span></span>
        </h1>
        <p class="hero-lede">{{ profile.lede }}</p>
        <div class="hero-actions">
          <router-link class="button button-primary" to="/work">See the work <span class="arrow" aria-hidden="true">→</span></router-link>
          <router-link class="button button-secondary" to="/about">About Rex</router-link>
        </div>
        <div class="hero-meta">
          <span>{{ profile.availability }}</span>
          <span>{{ profile.location }}</span>
        </div>
      </div>
      <div class="hero-panel">
        <div class="now-panel" aria-labelledby="now-title">
          <div class="now-top">
            <span class="pulse-dot" aria-hidden="true"></span>
            <span id="now-title">Working on now</span>
            <span class="mono">{{ now.length }} threads</span>
          </div>
          <ul class="now-list">
            <li v-for="n in now" :key="n.slug">
              <router-link class="now-item" :to="`/work/${n.slug}`">
                <span class="pulse-dot" aria-hidden="true"></span>
                <span><strong>{{ n.label }}</strong><span>{{ n.detail }}</span></span>
                <span class="arrow" aria-hidden="true">→</span>
              </router-link>
            </li>
          </ul>
          <div class="now-foot">
            <span>{{ latestLine }}</span>
            <span>{{ totals.repositories }} repos</span>
          </div>
        </div>
      </div>
    </section>

    <section class="trust-strip" aria-label="At a glance">
      <div class="container trust-grid">
        <div><StatCount :value="totals.repositories" /><span>repositories, one metadata contract</span></div>
        <div><StatCount :value="totals.products" /><span>shipped desktop and mobile products</span></div>
        <div><StatCount :value="totals.services" /><span>services in the LUCY assistant family</span></div>
        <div><strong>First Class</strong><span>BSc Computer Science with Cybersecurity</span></div>
      </div>
    </section>

    <section class="section" id="featured" aria-labelledby="featured-title">
      <div class="container">
        <div class="section-heading-row">
          <div class="section-heading reveal">
            <div class="eyebrow">Selected work</div>
            <h2 id="featured-title">Built to be <span>used</span>, not demoed.</h2>
            <p>Products people install, services other services depend on, and a runtime published to npm and PyPI. Every one of them has a site, a changelog and a test gate.</p>
          </div>
          <router-link class="link-arrow reveal" to="/work">All {{ totals.shown }} projects <span class="arrow" aria-hidden="true">→</span></router-link>
        </div>
        <div class="grid">
          <ProjectCard v-for="(p, i) in featured" :key="p.slug" :project="p" :featured="i === 0" :index="i" />
        </div>
      </div>
    </section>

    <section class="section" id="system" aria-labelledby="system-title">
      <div class="container">
        <div class="section-heading reveal">
          <div class="eyebrow">The LUCY family</div>
          <h2 id="system-title">One hub, <span>{{ totals.services - 1 }} services</span>, one rule.</h2>
          <p>Every service authenticates against keyring and hands the model data with provenance, never instructions. Hover or tab through the map.</p>
        </div>
        <SystemMap class="reveal" />
      </div>
    </section>

    <section v-if="activity.available && activity.calendar && activity.languages" class="section" id="activity" aria-labelledby="activity-title">
      <div class="container">
        <div class="section-heading reveal">
          <div class="eyebrow">GitHub, last 365 days</div>
          <h2 id="activity-title"><span>{{ activity.calendar.total.toLocaleString("en-GB") }}</span> contributions.</h2>
          <p>
            Pulled from GitHub when this site was built, {{ timeAgo(activity.fetchedAt) }}.
            {{ activity.counts?.commits.toLocaleString("en-GB") }} commits, {{ activity.counts?.pullRequests }} pull requests,
            {{ activity.counts?.repositoriesCreated }} repositories created.
          </p>
        </div>
        <div class="activity-grid">
          <div class="reveal activity-card">
            <h3>Contributions</h3>
            <ContributionGraph :days="activity.calendar.days" :total="activity.calendar.total" />
          </div>
          <div class="reveal activity-card" style="--delay: 120ms">
            <h3>Languages, by bytes of code</h3>
            <LanguageMix :languages="activity.languages" />
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="principles" aria-labelledby="principles-title">
      <div class="container">
        <div class="section-heading reveal">
          <div class="eyebrow">How I work</div>
          <h2 id="principles-title">Three rules I don't bend.</h2>
        </div>
        <div class="grid">
          <article v-for="(p, i) in profile.principles" :key="p.title" class="principle reveal" :style="{ '--delay': `${i * 70}ms` }">
            <span class="principle-number">0{{ i + 1 }}</span>
            <h3>{{ p.title }}</h3>
            <p>{{ p.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="cta-title">
      <div class="container">
        <div class="cta reveal">
          <div>
            <h2 id="cta-title">Hiring for AI or full-stack? <span>Let's talk.</span></h2>
            <p>{{ profile.availability }}. Email is fastest; every repository above is open for a look first.</p>
          </div>
          <div class="hero-actions">
            <a class="button button-primary" :href="`mailto:${profile.email}`">Email Rex <span class="arrow" aria-hidden="true">→</span></a>
            <a class="button button-secondary" :href="profile.github" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
.activity-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
}
.activity-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-l);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.activity-card h3 {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
@media (max-width: 1000px) {
  .activity-grid {
    grid-template-columns: 1fr;
  }
}
</style>

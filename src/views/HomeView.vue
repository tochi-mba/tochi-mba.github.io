<script setup lang="ts">
import { useHead } from "@unhead/vue";
import CaseStudyRowNow from "../components/CaseStudyRow.vue";
import ContributionGraphNow from "../components/ContributionGraph.vue";
import CopyButton from "../components/CopyButton.vue";
import LanguageMixNow from "../components/LanguageMix.vue";
import LiveLine from "../components/LiveLine.vue";
import LucyPeek from "../components/LucyPeek.vue";
import ShippingRibbonNow from "../components/ShippingRibbon.vue";
import SystemMapNow from "../components/SystemMap.vue";
import { useReveal } from "../composables/useReveal";
import { activity, featured, fill, lanes, lucyServices, profile, shipping, shortDate, site, totals } from "../data";
import { wakeLater } from "../wakeLater";

// Everything below the first screen is drawn with the page but woken in idle moments just after,
// so the first screen is interactive without waiting for the whole page (see wakeLater).
const ShippingRibbon = wakeLater(ShippingRibbonNow);
const CaseStudyRow = wakeLater(CaseStudyRowNow);
const SystemMap = wakeLater(SystemMapNow);
const ContributionGraph = wakeLater(ContributionGraphNow);
const LanguageMix = wakeLater(LanguageMixNow);

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
        sameAs: [profile.github, profile.linkedin].filter(Boolean),
        worksFor: { "@type": "Organization", name: profile.company },
      }),
    },
  ],
});

useReveal();

// Every section's words are the owner's, in data/profile.json; the numbers are filled in here.
const numbers = { services: lucyServices.length, shown: totals.shown, featured: featured.length };
const copy = Object.fromEntries(
  Object.entries(profile.home).map(([key, section]) => [
    key,
    {
      label: fill(section.label, numbers),
      title: fill(section.title, numbers),
      body: section.body ? fill(section.body, numbers) : "",
    },
  ]),
) as Record<keyof typeof profile.home, { label: string; title: string; body: string }>;

const releases = shipping.filter((e) => e.kind === "release").length;
const merged = shipping.filter((e) => e.kind === "pr").length;
const logSummary = [
  releases && `${releases} release${releases === 1 ? "" : "s"}`,
  merged && `${merged} merged pull request${merged === 1 ? "" : "s"}`,
]
  .filter(Boolean)
  .join(" and ");

// The current role, from the CV: the first experience entry that is not the portfolio's own work.
const job = profile.experience.find((e) => e.source === "cv");
const employer = job?.org.split(" · ")[0] ?? "";

const days = activity.calendar?.days ?? [];
const recentDays = days.slice(-91);
const activeDays = days.filter((d) => d[1] > 0).length;
const busiest = days.reduce<[string, number] | null>((a, d) => (!a || d[1] > a[1] ? d : a), null);
</script>

<template>
  <div>
    <section class="hero container" aria-labelledby="hero-title">
      <div class="hero-head">
        <h1 id="hero-title" class="hero-name">{{ profile.name }}</h1>
        <p class="hero-role">{{ profile.role }}</p>
      </div>
      <div class="hero-body">
        <div class="hero-intro">
          <p v-for="para in profile.intro" :key="para">{{ para }}</p>
        </div>
        <div class="hero-side">
          <LucyPeek class="hero-lucy" />
          <dl class="hero-facts mono">
            <div><dt>Based in</dt><dd>{{ profile.location }}</dd></div>
            <div><dt>Looking for</dt><dd>{{ profile.availability.replace(/^Open to /, "") }}</dd></div>
          </dl>
          <div class="hero-actions">
            <router-link class="button button-primary" to="/work">See the work <span class="arrow" aria-hidden="true">→</span></router-link>
            <a class="button button-secondary" :href="`mailto:${profile.email}`">Email Rex</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="how-i-work" aria-labelledby="how-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">How I work</p>
          <div class="section-title">
            <h2 id="how-title">{{ profile.howIWork.title }}</h2>
            <p>{{ profile.howIWork.body }}</p>
          </div>
        </header>
        <div class="section-body">
          <div class="principles">
            <article v-for="p in profile.howIWork.points" :key="p.title" class="principle">
              <h3>{{ p.title }}</h3>
              <p>{{ p.body }}</p>
            </article>
          </div>
          <div v-if="profile.howIWork.deeper.length" class="deeper">
            <p class="figure-label">Where I want to go deeper</p>
            <ul class="deeper-list mono">
              <li v-for="d in profile.howIWork.deeper" :key="d">{{ d }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section v-if="shipping.length" class="section log" aria-labelledby="log-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">{{ copy.buildLog.label }}</p>
          <div class="section-title">
            <div class="title-row">
              <h2 id="log-title">{{ copy.buildLog.title }}</h2>
              <LiveLine />
            </div>
            <p>{{ copy.buildLog.body }}</p>
            <p class="mono faint log-sub">The latest {{ logSummary }}, fetched {{ shortDate(site.generatedAt) }}.</p>
          </div>
        </header>
        <ShippingRibbon class="reveal" :events="shipping" :lanes="lanes" />
      </div>
    </section>

    <section class="section" id="work" aria-labelledby="work-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">{{ copy.topProjects.label }}</p>
          <div class="section-title">
            <div class="title-row">
              <h2 id="work-title">{{ copy.topProjects.title }}</h2>
              <span class="title-count mono faint">{{ featured.length }} of {{ totals.shown }}</span>
            </div>
            <p v-if="copy.topProjects.body">{{ copy.topProjects.body }}</p>
          </div>
        </header>
        <div class="cases">
          <CaseStudyRow v-for="p in featured" :key="p.slug" :project="p" />
        </div>
        <p class="section-more section-body"><router-link class="link-arrow" to="/work">All {{ totals.shown }} projects <span aria-hidden="true">→</span></router-link></p>
      </div>
    </section>

    <section v-if="job" class="section" id="experience" aria-labelledby="experience-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">Day job · {{ job.period }}</p>
          <div class="section-title">
            <h2 id="experience-title">{{ job.title }} at {{ employer }}.</h2>
            <p>{{ job.summary }}</p>
          </div>
        </header>
        <div class="section-body">
          <ul v-if="job.points?.length" class="points reveal">
            <li v-for="point in job.points" :key="point">{{ point }}</li>
          </ul>
          <p class="section-more"><router-link class="link-arrow" to="/about">Experience and education <span aria-hidden="true">→</span></router-link></p>
        </div>
      </div>
    </section>

    <section class="section" id="system" aria-labelledby="system-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">{{ copy.lucy.label }}</p>
          <div class="section-title">
            <h2 id="system-title">{{ copy.lucy.title }}</h2>
            <p v-if="copy.lucy.body">{{ copy.lucy.body }}</p>
          </div>
        </header>
        <SystemMap class="reveal" />
      </div>
    </section>

    <section v-if="activity.available && activity.calendar" class="section" id="activity" aria-labelledby="activity-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">{{ copy.activity.label }}</p>
          <div class="section-title">
            <h2 id="activity-title">{{ copy.activity.title }}</h2>
            <p>
              {{ activity.calendar.total.toLocaleString("en-GB") }} contributions on {{ activeDays }} days:
              {{ activity.counts?.commits.toLocaleString("en-GB") }} commits and {{ activity.counts?.pullRequests }} pull requests<template v-if="busiest && busiest[1] > 0">, the busiest day {{ busiest[1] }} on {{ shortDate(busiest[0]) }}</template>.
              <template v-if="copy.activity.body">{{ copy.activity.body }}</template>
            </p>
          </div>
        </header>
        <div class="work-went section-body">
          <div class="strip reveal">
            <p class="figure-label">Last 13 weeks</p>
            <ContributionGraph :days="recentDays" :total="recentDays.reduce((a, d) => a + d[1], 0)" period="in the last 13 weeks" />
          </div>
          <div v-if="activity.languages?.length" class="langs-wrap reveal" style="--delay: 120ms">
            <p class="figure-label">Languages, by bytes of current code</p>
            <LanguageMix :languages="activity.languages" />
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="contact" aria-labelledby="contact-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">{{ copy.contact.label }}</p>
          <div class="section-title">
            <h2 id="contact-title">{{ copy.contact.title }}</h2>
            <p>{{ profile.availability }}.<template v-if="copy.contact.body"> {{ copy.contact.body }}</template></p>
          </div>
        </header>
        <div class="contact section-body">
          <a class="contact-mail" :href="`mailto:${profile.email}`">{{ profile.email }}</a>
          <div class="contact-row">
            <CopyButton :text="profile.email" label="Copy email" />
            <a :href="profile.github" target="_blank" rel="noopener noreferrer">github.com/{{ profile.handle }} ↗</a>
            <a v-if="profile.linkedin" :href="profile.linkedin" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

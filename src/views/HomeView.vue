<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { computed } from "vue";
import CaseStudyRow from "../components/CaseStudyRow.vue";
import ContributionGraph from "../components/ContributionGraph.vue";
import CopyButton from "../components/CopyButton.vue";
import LanguageMix from "../components/LanguageMix.vue";
import LiveLine from "../components/LiveLine.vue";
import ShippingRibbon from "../components/ShippingRibbon.vue";
import SystemMap from "../components/SystemMap.vue";
import { useReveal } from "../composables/useReveal";
import { activity, featured, lanes, lucyServices, profile, shipping, shortDate, site, totals } from "../data";

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

// The headline on two lines, broken at the word nearest its middle.
const headline = computed(() => {
  const words = profile.headline.split(" ");
  let best = 1;
  for (let i = 1; i < words.length; i += 1) {
    const left = words.slice(0, i).join(" ").length;
    const bestLeft = words.slice(0, best).join(" ").length;
    if (Math.abs(left * 2 - profile.headline.length) < Math.abs(bestLeft * 2 - profile.headline.length)) best = i;
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
});

const releases = shipping.filter((e) => e.kind === "release").length;
const merged = shipping.filter((e) => e.kind === "pr").length;
const logSummary = [
  releases && `${releases} release${releases === 1 ? "" : "s"}`,
  merged && `${merged} merged pull request${merged === 1 ? "" : "s"}`,
]
  .filter(Boolean)
  .join(" and ");

const services = lucyServices.length;

// The current role, from the CV: the first experience entry that is not the portfolio's own work.
const job = profile.experience.find((e) => e.source === "cv");
const employer = job?.org.split(" · ")[0] ?? "";

const days = activity.calendar?.days ?? [];
const recentDays = days.slice(-91);
const activeDays = days.filter((d) => d[1] > 0).length;
const busiest = days.reduce<[string, number] | null>((a, d) => (!a || d[1] > a[1] ? d : a), null);

const rigour = [
  "Lint, types, imports and tests at 100% branch coverage in every LUCY repository",
  "This site: Playwright and axe in Chromium, Firefox and WebKit, phone to desktop, both themes",
  "A dead or private link never reaches a page",
  "Rebuilt from GitHub, npm and PyPI every day",
];
</script>

<template>
  <div>
    <section class="hero container" aria-labelledby="hero-title">
      <h1 id="hero-title" class="hero-title">
        <span class="line">{{ headline[0] }}</span>
        <span class="line">{{ headline[1] }}</span>
      </h1>
      <div class="hero-body">
        <p class="hero-lede">{{ profile.lede }}</p>
        <div class="hero-side">
          <dl class="hero-facts mono">
            <div><dt>Who</dt><dd>{{ profile.name }}, call me Rex</dd></div>
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

    <section v-if="shipping.length" class="log container" aria-labelledby="log-title">
      <div class="log-head">
        <div>
          <h2 id="log-title" class="log-title">Build log</h2>
          <span class="log-sub mono faint">the latest {{ logSummary }}, fetched {{ shortDate(site.generatedAt) }}</span>
        </div>
        <LiveLine />
      </div>
      <ShippingRibbon class="reveal" :events="shipping" :lanes="lanes" />
    </section>

    <section class="section" id="work" aria-labelledby="work-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">Selected work · {{ featured.length }} of {{ totals.shown }}</p>
          <div class="section-title">
            <h2 id="work-title">Built to be used, not demoed.</h2>
            <p>Products people install, services other services depend on, and a runtime published to npm and PyPI. Every one has a site, a changelog and a test gate.</p>
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
          <p class="section-label">The LUCY system · {{ services }} services</p>
          <div class="section-title">
            <h2 id="system-title">One hub, {{ services }} services, one rule.</h2>
            <p>Every service authenticates against keyring and hands the model data with provenance, never instructions. Pick one to see what it does.</p>
          </div>
        </header>
        <SystemMap class="reveal" />
      </div>
    </section>

    <section v-if="activity.available && activity.calendar" class="section" id="activity" aria-labelledby="activity-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">GitHub · last 12 months</p>
          <div class="section-title">
            <h2 id="activity-title">Where the work went.</h2>
            <p>
              {{ activity.calendar.total.toLocaleString("en-GB") }} contributions on {{ activeDays }} days:
              {{ activity.counts?.commits.toLocaleString("en-GB") }} commits and {{ activity.counts?.pullRequests }} pull requests<template v-if="busiest && busiest[1] > 0">, the busiest day {{ busiest[1] }} on {{ shortDate(busiest[0]) }}</template>.
              The build log above is the record of what shipped.
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

    <section class="section" id="principles" aria-labelledby="principles-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">How I work</p>
          <div class="section-title">
            <h2 id="principles-title">Three rules I don't bend.</h2>
          </div>
        </header>
        <div class="section-body">
          <div class="principles">
            <article v-for="p in profile.principles" :key="p.title" class="principle">
              <h3>{{ p.title }}</h3>
              <p>{{ p.body }}</p>
            </article>
          </div>
          <ul class="rigour mono" aria-label="Engineering practice">
            <li v-for="r in rigour" :key="r">{{ r }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section" id="contact" aria-labelledby="contact-title">
      <div class="container">
        <header class="section-head">
          <p class="section-label">Contact</p>
          <div class="section-title">
            <h2 id="contact-title">Hiring for AI or full-stack? Let's talk.</h2>
            <p>{{ profile.availability }}. Email is fastest; every public repository above is open for a look first.</p>
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

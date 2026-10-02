<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { computed } from "vue";
import ProofChips from "../components/ProofChips.vue";
import { useReveal } from "../composables/useReveal";
import { bySlug, CATEGORY_LABEL, profile, projects, STATUS_LABEL, shortDate } from "../data";
import NotFoundView from "./NotFoundView.vue";

const props = defineProps<{ slug: string }>();
const project = computed(() => bySlug.get(props.slug));

const index = computed(() => projects.findIndex((p) => p.slug === props.slug));
const prev = computed(() => (index.value > 0 ? projects[index.value - 1] : undefined));
const next = computed(() =>
  index.value >= 0 && index.value < projects.length - 1 ? projects[index.value + 1] : undefined,
);

const related = computed(() => {
  const p = project.value;
  if (!p) return [];
  const pool = projects.filter((o) => o.slug !== p.slug && o.category !== "early");
  const same = pool.filter((o) => (p.family && o.family === p.family) || o.category === p.category);
  return same.slice(0, 3);
});

useHead(() => {
  const p = project.value;
  if (!p) return { title: "Not found" };
  const description =
    p.tagline || `${p.name}, a ${CATEGORY_LABEL[p.category].toLowerCase()} project by ${profile.name}.`;
  return {
    title: p.name,
    link: [{ rel: "canonical", href: `${profile.site}work/${p.slug}` }],
    meta: [
      { name: "description", content: description },
      { property: "og:title", content: `${p.name} · ${profile.name}` },
      { property: "og:description", content: description },
      { property: "og:url", content: `${profile.site}work/${p.slug}` },
    ],
    script:
      p.visibility === "public"
        ? [
            {
              type: "application/ld+json",
              innerHTML: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SoftwareSourceCode",
                name: p.name,
                description,
                codeRepository: p.links.source,
                url: `${profile.site}work/${p.slug}`,
                programmingLanguage: p.stack,
                author: { "@type": "Person", name: profile.name },
              }),
            },
          ]
        : [],
  };
});

useReveal();

const linkLabel: Record<string, string> = {
  site: "Website",
  download: "Download",
  package: "Package",
  source: "Source on GitHub",
};
// The project's own site first, then a way to run it, then the code.
const links = computed(() => {
  const l = project.value?.links ?? {};
  return (["site", "download", "package", "source"] as const)
    .filter((k) => l[k])
    .map((k, i) => ({ kind: k, href: l[k]!, label: linkLabel[k]!, primary: i === 0 }));
});
</script>

<template>
  <NotFoundView v-if="!project" />
  <div v-else class="container">
    <header class="page-hero">
      <nav aria-label="Breadcrumb" class="crumbs">
        <router-link to="/work">Work</router-link> <span aria-hidden="true">/</span> {{ CATEGORY_LABEL[project.category] }}
      </nav>
      <h1>{{ project.name }}</h1>
      <p v-if="project.tagline" class="lede">{{ project.tagline }}</p>
      <ProofChips class="project-proof" :project="project" :max="6" />
      <p class="mono faint">
        <span class="status" :class="`status-${project.status}`">{{ STATUS_LABEL[project.status] }}</span>
        <span v-if="project.visibility === 'private'"> · Private repository</span>
        <span v-if="project.family === 'lucy'"> · LUCY family · {{ project.role }}</span>
      </p>
    </header>

    <div class="project-layout">
      <article class="prose">
        <template v-if="project.description">
          <p v-for="(para, i) in project.description.split(/\n\n+/)" :key="i">{{ para }}</p>
        </template>
        <p v-else-if="project.visibility === 'private'">
          This repository is private. It is listed here so the portfolio is complete; the code and a walkthrough are available on request.
        </p>
        <p v-else>A small, early repository. The code says more than a paragraph here would.</p>

        <template v-if="project.highlights.length">
          <h2>What stands out</h2>
          <ul class="highlights">
            <li v-for="h in project.highlights" :key="h">{{ h }}</li>
          </ul>
        </template>
      </article>

      <aside class="aside" aria-label="Project details">
        <div v-if="links.length" class="links">
          <a
            v-for="l in links"
            :key="l.kind"
            class="button"
            :class="l.primary ? 'button-primary' : 'button-secondary'"
            :href="l.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ l.label }} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div v-if="project.proof?.release" class="release-card">
          <h2>Latest release</h2>
          <strong><a :href="project.proof.release.url" target="_blank" rel="noopener noreferrer">{{ project.proof.release.tag }}</a></strong>
          <span class="mono faint">{{ shortDate(project.proof.release.at) }}{{ project.proof.release.prerelease ? " · pre-release" : "" }} · {{ project.proof.release.count }} release{{ project.proof.release.count === 1 ? "" : "s" }}</span>
          <span v-if="project.proof.release.words" class="muted">{{ project.proof.release.words }}</span>
        </div>
        <div v-if="project.proof?.npm || project.proof?.pypi" class="release-card">
          <h2>Published</h2>
          <span v-if="project.proof?.npm" class="mono">
            <a :href="project.proof.npm.url" target="_blank" rel="noopener noreferrer">npm {{ project.proof.npm.name }}</a> v{{ project.proof.npm.version }}<template v-if="project.proof.npm.packages > 1"> · {{ project.proof.npm.packages }} packages</template>
          </span>
          <span v-if="project.proof?.pypi" class="mono">
            <a :href="project.proof.pypi.url" target="_blank" rel="noopener noreferrer">PyPI {{ project.proof.pypi.name }}</a> v{{ project.proof.pypi.version }}<template v-if="project.proof.pypi.packages > 1"> · {{ project.proof.pypi.packages }} packages</template>
          </span>
        </div>
        <div>
          <h2>Stack</h2>
          <p v-if="project.stack.length" class="stack-line">{{ project.stack.join(" · ") }}</p>
          <p v-else class="stack-line">Not recorded.</p>
        </div>
        <dl class="dl">
          <template v-if="project.repo">
            <dt>Repository</dt>
            <dd><code>{{ project.repo }}</code></dd>
          </template>
          <dt>Category</dt>
          <dd>{{ CATEGORY_LABEL[project.category] }}</dd>
          <dt>Year</dt>
          <dd>{{ project.year }}</dd>
          <dt>Visibility</dt>
          <dd>{{ project.visibility }}</dd>
          <template v-if="project.proof?.commits">
            <dt>Commits</dt>
            <dd>{{ project.proof.commits.toLocaleString("en-GB") }}</dd>
          </template>
        </dl>
      </aside>
    </div>

    <section v-if="related.length" class="related" aria-labelledby="related-title">
      <header class="work-group-head">
        <h2 id="related-title">More like this</h2>
      </header>
      <ul class="work-list">
        <li v-for="p in related" :key="p.slug" class="work-row">
          <router-link class="work-main" :to="`/work/${p.slug}`">
            <span class="work-name">{{ p.name }}</span>
            <span class="work-what">{{ p.tagline }}</span>
            <span class="work-meta">{{ p.stack.slice(0, 2).join(" · ") }}</span>
          </router-link>
          <a v-if="p.links.site" class="work-site" :href="p.links.site" target="_blank" rel="noopener noreferrer" :aria-label="`${p.name} website`">site ↗</a>
        </li>
      </ul>
    </section>

    <nav class="pager" aria-label="Previous and next project">
      <router-link v-if="prev" :to="`/work/${prev.slug}`" rel="prev"><small>← Previous</small><strong>{{ prev.name }}</strong></router-link>
      <span v-else></span>
      <router-link v-if="next" class="next" :to="`/work/${next.slug}`" rel="next"><small>Next →</small><strong>{{ next.name }}</strong></router-link>
    </nav>
  </div>
</template>

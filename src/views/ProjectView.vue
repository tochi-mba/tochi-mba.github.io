<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { computed } from "vue";
import ProjectCard from "../components/ProjectCard.vue";
import { useReveal } from "../composables/useReveal";
import { bySlug, CATEGORY_LABEL, profile, projects, STATUS_LABEL } from "../data";
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
  source: "Source on GitHub",
  download: "Download",
  package: "Package",
};
</script>

<template>
  <NotFoundView v-if="!project" />
  <div v-else class="container">
    <header class="page-hero">
      <nav aria-label="Breadcrumb" class="eyebrow">
        <router-link to="/work" style="color: inherit">Work</router-link> <span aria-hidden="true">/</span> {{ CATEGORY_LABEL[project.category] }}
      </nav>
      <h1>{{ project.name }}</h1>
      <p v-if="project.tagline" class="hero-lede">{{ project.tagline }}</p>
      <div class="hero-meta">
        <span class="badge" :class="`badge-${project.status}`">{{ STATUS_LABEL[project.status] }}</span>
        <span v-if="project.visibility === 'private'">Private repository</span>
        <span v-if="project.family === 'lucy'">LUCY family · {{ project.role }}</span>
      </div>
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
        <div v-if="Object.keys(project.links).length" class="links">
          <template v-for="(href, kind) in project.links" :key="kind">
            <a class="button" :class="kind === 'site' || (kind === 'source' && !project.links.site) ? 'button-primary' : 'button-secondary'" :href="href" target="_blank" rel="noopener noreferrer">
              {{ linkLabel[kind] }} <span aria-hidden="true">↗</span>
            </a>
          </template>
        </div>
        <div>
          <h2>Stack</h2>
          <ul v-if="project.stack.length" class="tags" style="margin-top: 8px">
            <li v-for="s in project.stack" :key="s" class="tag">{{ s }}</li>
          </ul>
          <p v-else class="results-line" style="margin: 8px 0 0">Not recorded.</p>
        </div>
        <dl class="dl">
          <dt>Repository</dt>
          <dd><code>{{ project.repo }}</code></dd>
          <dt>Category</dt>
          <dd>{{ CATEGORY_LABEL[project.category] }}</dd>
          <dt>Year</dt>
          <dd>{{ project.year }}</dd>
          <dt>Visibility</dt>
          <dd>{{ project.visibility }}</dd>
        </dl>
      </aside>
    </div>

    <section v-if="related.length" class="related" aria-labelledby="related-title">
      <div class="section-heading">
        <div class="eyebrow">Related</div>
        <h2 id="related-title" style="font-size: 26px">More like this</h2>
      </div>
      <div class="grid">
        <ProjectCard v-for="(p, i) in related" :key="p.slug" :project="p" :index="i" />
      </div>
    </section>

    <nav class="pager" aria-label="Previous and next project">
      <router-link v-if="prev" :to="`/work/${prev.slug}`" rel="prev"><small>← Previous</small><strong>{{ prev.name }}</strong></router-link>
      <span v-else></span>
      <router-link v-if="next" class="next" :to="`/work/${next.slug}`" rel="next"><small>Next →</small><strong>{{ next.name }}</strong></router-link>
    </nav>
  </div>
</template>

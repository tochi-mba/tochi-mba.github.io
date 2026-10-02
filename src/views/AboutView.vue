<script setup lang="ts">
import { useHead } from "@unhead/vue";
import CopyButton from "../components/CopyButton.vue";
import { useReveal } from "../composables/useReveal";
import { bySlug, profile, shipping, shortDate, totals } from "../data";

useHead({
  title: "About",
  link: [{ rel: "canonical", href: `${profile.site}about` }],
  meta: [
    {
      name: "description",
      content: `${profile.name} (Rex): ${profile.role}, working solo as ${profile.company}. Experience, education, skills and how to get in touch.`,
    },
    { property: "og:title", content: `About · ${profile.name}` },
    { property: "og:url", content: `${profile.site}about` },
  ],
});
useReveal();

const shipped = shipping.slice(0, 10);
const now = profile.now.map((n) => ({ ...n, project: bySlug.get(n.slug)! }));
</script>

<template>
  <div class="container">
    <header class="page-hero">
      <p class="crumbs">About</p>
      <h1>Tochi Mba. Call me Rex.</h1>
      <p class="lede">
        {{ profile.role }}, working solo under the name {{ profile.company }}. I build the kind of software I would want to depend on:
        services that refuse to store a credential, installers that need no admin rights, and the same four test gates in every repository.
      </p>
    </header>

    <div class="about-grid">
      <div class="about-main">
        <section class="reveal" aria-labelledby="exp-title">
          <h2 id="exp-title">Experience</h2>
          <ol class="entries">
            <li v-for="e in profile.experience" :key="e.title + e.org">
              <span class="period">{{ e.period }}</span>
              <div class="entry-body">
                <h3>{{ e.title }}</h3>
                <span class="org">{{ e.org }}</span>
                <p v-if="e.summary">{{ e.summary }}</p>
                <ul v-if="e.points?.length" class="points">
                  <li v-for="point in e.points" :key="point">{{ point }}</li>
                </ul>
              </div>
            </li>
          </ol>
        </section>

        <section class="reveal" aria-labelledby="edu-title">
          <h2 id="edu-title">Education</h2>
          <ol class="entries">
            <li v-for="e in profile.education" :key="e.title">
              <span class="period">{{ e.period }}</span>
              <div class="entry-body">
                <h3>{{ e.title }}</h3>
                <span class="org">{{ e.org }}</span>
                <p v-if="e.summary">{{ e.summary }}</p>
              </div>
            </li>
          </ol>
        </section>

        <section v-if="shipped.length" class="reveal" aria-labelledby="shipped-title">
          <h2 id="shipped-title">Recently shipped</h2>
          <ol class="entries shipped-list">
            <li v-for="e in shipped" :key="e.id">
              <time class="period" :datetime="e.at">{{ shortDate(e.at) }}</time>
              <div class="entry-body">
                <a :href="e.url" target="_blank" rel="noopener noreferrer">{{ e.title }}</a>
                <span v-if="e.words" class="org"> · {{ e.words }}</span>
                <span v-if="e.channels.length" class="mono faint"> · {{ e.channels.join(", ") }}</span>
              </div>
            </li>
          </ol>
        </section>

        <section class="reveal" aria-labelledby="skills-title">
          <h2 id="skills-title">Skills</h2>
          <dl class="skills-list">
            <div v-for="g in profile.skills" :key="g.group">
              <dt>{{ g.group }}</dt>
              <dd>{{ g.items.join(", ") }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <aside class="about-aside reveal" aria-label="Contact" style="--delay: 120ms">
        <div>
          <h2>Contact</h2>
          <div class="contact-card">
            <div class="contact-line">
              <code>{{ profile.email }}</code>
              <CopyButton :text="profile.email" />
            </div>
            <div class="contact-line">
              <code>github.com/{{ profile.handle }}</code>
              <a :href="profile.github" target="_blank" rel="noopener noreferrer">Open ↗</a>
            </div>
            <div v-if="profile.linkedin" class="contact-line">
              <code>linkedin.com/in/{{ profile.handle }}</code>
              <a :href="profile.linkedin" target="_blank" rel="noopener noreferrer" aria-label="Open LinkedIn">Open ↗</a>
            </div>
            <a class="button button-primary" :href="`mailto:${profile.email}?subject=Hello%20Rex`">Email Rex <span class="arrow" aria-hidden="true">→</span></a>
          </div>
        </div>
        <div>
          <h2>Working on now</h2>
          <ul class="now-list">
            <li v-for="n in now" :key="n.slug">
              <router-link :to="`/work/${n.slug}`">{{ n.label }}</router-link>
              <span class="now-detail">{{ n.detail }}</span>
            </li>
          </ul>
        </div>
        <dl class="dl">
          <dt>Based in</dt>
          <dd>{{ profile.location }}</dd>
          <dt>Status</dt>
          <dd>{{ profile.availability }}</dd>
          <dt>Repositories</dt>
          <dd>{{ totals.repositories }} on GitHub, {{ totals.shown }} shown here</dd>
        </dl>
      </aside>
    </div>
  </div>
</template>

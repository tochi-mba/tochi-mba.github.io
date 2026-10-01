<script setup lang="ts">
import { useHead } from "@unhead/vue";
import CopyButton from "../components/CopyButton.vue";
import { useReveal } from "../composables/useReveal";
import { profile, totals } from "../data";

useHead({
  title: "About",
  link: [{ rel: "canonical", href: `${profile.site}about` }],
  meta: [
    {
      name: "description",
      content: `${profile.name} (Rex): ${profile.role}, founder of ${profile.company}. Experience, education, skills and how to get in touch.`,
    },
    { property: "og:title", content: `About · ${profile.name}` },
    { property: "og:url", content: `${profile.site}about` },
  ],
});
useReveal();
</script>

<template>
  <div class="container">
    <header class="page-hero">
      <div class="eyebrow">About</div>
      <h1>Tochi Mba. <span>Call me Rex.</span></h1>
      <p class="hero-lede">
        {{ profile.role }} and the person behind {{ profile.company }}. I build the kind of software I would want to depend on:
        services that refuse to store a credential, installers that need no admin rights, and tests that run the same four gates in every repository.
      </p>
    </header>

    <div class="about-grid">
      <div>
        <section class="reveal" aria-labelledby="exp-title">
          <div class="section-heading">
            <div class="eyebrow">Experience</div>
            <h2 id="exp-title" style="font-size: 28px">What I've built and where</h2>
          </div>
          <ol class="timeline">
            <li v-for="e in profile.experience" :key="e.title + e.org">
              <span class="period">{{ e.period }}</span>
              <h3>{{ e.title }}</h3>
              <span class="org">{{ e.org }}</span>
              <p v-if="e.summary">{{ e.summary }}</p>
            </li>
          </ol>
        </section>

        <section class="reveal" aria-labelledby="edu-title" style="margin-top: 32px">
          <div class="section-heading">
            <div class="eyebrow">Education</div>
            <h2 id="edu-title" style="font-size: 28px">First Class, with Cybersecurity</h2>
          </div>
          <ol class="timeline">
            <li v-for="e in profile.education" :key="e.title">
              <span class="period">{{ e.period }}</span>
              <h3>{{ e.title }}</h3>
              <span class="org">{{ e.org }}</span>
              <p v-if="e.summary">{{ e.summary }}</p>
            </li>
          </ol>
        </section>

        <section class="reveal" aria-labelledby="skills-title" style="margin-top: 32px">
          <div class="section-heading">
            <div class="eyebrow">Skills</div>
            <h2 id="skills-title" style="font-size: 28px">The toolbox</h2>
            <p>Grouped by what I reach for them to do, not alphabetically. Everything here appears in at least one shipped repository.</p>
          </div>
          <div class="skills">
            <div v-for="g in profile.skills" :key="g.group">
              <h3>{{ g.group }}</h3>
              <ul class="tags">
                <li v-for="s in g.items" :key="s" class="tag">{{ s }}</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <aside class="aside reveal" aria-label="Contact" style="--delay: 120ms">
        <h2>Contact</h2>
        <div class="contact-card">
          <div class="contact-row">
            <code>{{ profile.email }}</code>
            <CopyButton :text="profile.email" />
          </div>
          <div class="contact-row">
            <code>github.com/{{ profile.handle }}</code>
            <a class="copy-button" :href="profile.github" target="_blank" rel="noopener noreferrer">Open ↗</a>
          </div>
        </div>
        <a class="button button-primary" :href="`mailto:${profile.email}?subject=Hello%20Rex`">Email Rex <span class="arrow" aria-hidden="true">→</span></a>
        <dl class="dl">
          <dt>Based in</dt>
          <dd>{{ profile.location }}</dd>
          <dt>Status</dt>
          <dd>{{ profile.availability }}</dd>
          <dt>Repositories</dt>
          <dd>{{ totals.repositories }} ({{ totals.public }} public)</dd>
        </dl>
      </aside>
    </div>
  </div>
</template>

<template>
  <Navbar class="navbar" @updateAuthMode="authMode = $event" />
  <Auth class="auth-form" v-show="authMode !== ''" :mode="authMode" @close="authMode = ''" />
  <div id="app">
    <RouterView />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Navbar from './components/Navbar.vue'
import Auth from '@/components/AuthForms.vue'

const authMode = ref('') // 'login', 'signup', or ''
</script>

<style>
@import '@/styles/generalGames.scss';

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  background-color: black;
}

#app {
  width: 100%;
  height: 100vh;
  padding-top: 1.5rem; /* Push content down by navbar height */
}
</style>
